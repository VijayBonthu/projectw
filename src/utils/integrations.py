import requests
from fastapi import HTTPException
import os
from utils.logger import logger

class Integrations:
    def __init__(self, token: str):
        self.token = token
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/json"
        }
        
        # Only one requests.get() call
        response = requests.get("https://api.atlassian.com/oauth/token/accessible-resources", headers=self.headers)

        if response.status_code == 200:
            self.resources = response.json()  # Parse JSON response
        elif response.status_code == 401:
            raise HTTPException(status_code=401, detail="Invalid details")
        else:
            raise HTTPException(status_code=500, detail="Internal server error")

    # def get_resources(self):
    #     return self.resources  
    
    def get_all_issues(self):

        try:
            user_resource_details = self.resources
            user_id = user_resource_details[0]["id"]
            jira_domain = self.resources[0]["url"]# Return parsed JSON instead of raw response
            JIRA_API_URL = f"https://api.atlassian.com/ex/jira/{user_id}/rest/api/3/search"   
            headers = self.headers
            params = {
                "jql": "assignee=currentUser()",
                "fields": "key,summary,description,attachment"
            }

            response  = requests.get(JIRA_API_URL, headers=headers, params=params)
            
            if response.status_code == 200:
                return response.json()  # Parse JSON response
            elif response.status_code == 401:
                raise HTTPException(status_code=401, detail="Invalid details")
            else:
                raise HTTPException(status_code=500, detail="Internal server error")
        except HTTPException as e:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Internal server error: {e}")

    def download_jira_attachments(self, issue_key=None, attachment_id=None, download_file_name=None):

        """
        Download attachments for Jira issues
        
        :param access_token: Jira OAuth access token
        :param cloud_id: Atlassian Cloud ID
        :param issue_key: Specific issue key (optional)
        :return: List of downloaded files
        """
        # Prepare headers for API request
        headers = self.headers

        cloud_id  = self.resources[0]["id"]
        
        # Base URLs
        base_url = f'https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3'
        
        base_url = f'https://api.atlassian.com/ex/jira/{cloud_id}/rest/api/3'
    
        # Prepare JQL query
        jql = 'attachments IS NOT EMPTY'
        if issue_key:
            jql = f'issue = {issue_key}'
        
        # Search for issues with attachments
        search_params = {
            'jql': jql,
            'fields': ['attachment'],
            'maxResults': 50
        }
        
        # Perform search request
        search_response = requests.get(
            f'{base_url}/search', 
            headers=headers, 
            params=search_params
        )
        search_response.raise_for_status()

        logger.info(f"search_response: {search_response.json()}")

        
        # Prepare download directory
        download_dir = 'jira_attachments'
        os.makedirs(download_dir, exist_ok=True)
        
        # Track downloaded files
        downloaded_files = []
        
        # Process each issue
        for issue in search_response.json()['issues']:
            # Create issue-specific directory
            issue_dir = os.path.join(download_dir, issue['key'])
            os.makedirs(issue_dir, exist_ok=True)
            
            # Get attachments for this issue
            attachments = issue['fields'].get('attachment', [])

            if attachment_id:
                attachments= [a for a in attachments if str(a['id']) == str(attachment_id)]
        
            if download_file_name:
                    attachments= [a for a in attachments if a['filename'] == str(download_file_name)]
            
            # Validate attachments
            if not attachments:
                print(f"No matching attachments found for issue {issue_key}")
                return None

            
            
            # Download each attachment
            for attachment in attachments:
                try:
                    # Prepare download
                    filename =attachment['id']+ "_" + attachment['filename']
                    file_path = os.path.join(issue_dir, filename)
                    
                    # Download file
                    file_response = requests.get(
                        attachment['content'], 
                        headers=headers,
                        stream=True
                    )
                    file_response.raise_for_status()
                    
                    # Save file
                    with open(file_path, 'wb') as f:
                        for chunk in file_response.iter_content(chunk_size=8192):
                            f.write(chunk)
                    
                    # Track downloaded file
                    downloaded_files.append({
                        'issue_key': issue['key'],
                        'filename': filename,
                        'local_path': file_path,
                        'attachment_id': attachment['id']
                    })
                    
                    print(f"Downloaded: {issue['key']} - {filename}")
                
                except Exception as e:
                    print(f"Error downloading {filename}: {e}")
        
        return downloaded_files

# token = "eyJraWQiOiJhdXRoLmF0bGFzc2lhbi5jb20tQUNDRVNTLTk0ZTczYTkwLTUxYWQtNGFjMS1hOWFjLWU4NGUwNDVjNDU3ZCIsImFsZyI6IlJTMjU2In0.eyJqdGkiOiJlNTI3ODlkOS0zYWIxLTRhYTQtOGRkYy03ZGY2NTg5ZWZmNjkiLCJzdWIiOiI3MTIwMjA6Y2QyMzdlMjMtOTg5My00Y2M0LWI1YmUtZGIxYzYyMWNkY2IyIiwibmJmIjoxNzQyODU2MzU0LCJpc3MiOiJodHRwczovL2F1dGguYXRsYXNzaWFuLmNvbSIsImlhdCI6MTc0Mjg1NjM1NCwiZXhwIjoxNzQyODU5OTU0LCJhdWQiOiJJbUtNbGNKQndnUmdGSzNpWmx4YjdNZGRUajNHWVkzcSIsImh0dHBzOi8vYXRsYXNzaWFuLmNvbS9zeXN0ZW1BY2NvdW50SWQiOiI3MTIwMjA6OWU3MDhiMTEtNzZhNC00NTk2LTgxNmYtZGNmYWJhNTM1NWExIiwiaHR0cHM6Ly9pZC5hdGxhc3NpYW4uY29tL3J0aSI6IjQ1MjVkNzRjLWFiZGEtNGRkNC04NmU1LTIyZjc5YjQxMGU4MCIsImh0dHBzOi8vYXRsYXNzaWFuLmNvbS9zeXN0ZW1BY2NvdW50RW1haWwiOiIwNzhmNzBiMC1jYjBjLTRjNmMtYTUwZS0wOWVhMjY1NjQ0MGVAY29ubmVjdC5hdGxhc3NpYW4uY29tIiwiaHR0cHM6Ly9pZC5hdGxhc3NpYW4uY29tL3JlZnJlc2hfY2hhaW5faWQiOiJJbUtNbGNKQndnUmdGSzNpWmx4YjdNZGRUajNHWVkzcS03MTIwMjA6Y2QyMzdlMjMtOTg5My00Y2M0LWI1YmUtZGIxYzYyMWNkY2IyLTljYTY3MDgyLTlkMWYtNGE4Ni05NDdiLTJhNWQyM2JiNDA0ZCIsImh0dHBzOi8vaWQuYXRsYXNzaWFuLmNvbS9hdGxfdG9rZW5fdHlwZSI6IkFDQ0VTUyIsImNsaWVudF9pZCI6IkltS01sY0pCd2dSZ0ZLM2labHhiN01kZFRqM0dZWTNxIiwiaHR0cHM6Ly9hdGxhc3NpYW4uY29tL2ZpcnN0UGFydHkiOmZhbHNlLCJodHRwczovL2F0bGFzc2lhbi5jb20vdmVyaWZpZWQiOnRydWUsImh0dHBzOi8vaWQuYXRsYXNzaWFuLmNvbS9zZXNzaW9uX2lkIjoiN2U5NTEwYzEtNmVjMy00MDYwLWFlNWQtODJmMzZiYWRmYzAxIiwiaHR0cHM6Ly9pZC5hdGxhc3NpYW4uY29tL3Byb2Nlc3NSZWdpb24iOiJ1cy1lYXN0LTEiLCJodHRwczovL2F0bGFzc2lhbi5jb20vZW1haWxEb21haW4iOiJnbWFpbC5jb20iLCJodHRwczovL2F0bGFzc2lhbi5jb20vM2xvIjp0cnVlLCJodHRwczovL2lkLmF0bGFzc2lhbi5jb20vdWp0IjoiYWFhMzM5NDAtNmJkMS00MzhkLTk5ZjItMmU2NDY3MWM1MWI1IiwiaHR0cHM6Ly9pZC5hdGxhc3NpYW4uY29tL3ZlcmlmaWVkIjp0cnVlLCJzY29wZSI6Im9mZmxpbmVfYWNjZXNzIHJlYWQ6YWNjb3VudCByZWFkOmppcmEtdXNlciByZWFkOmppcmEtd29yayByZWFkOm1lIHdyaXRlOmppcmEtd29yayIsImh0dHBzOi8vYXRsYXNzaWFuLmNvbS9vYXV0aENsaWVudElkIjoiSW1LTWxjSkJ3Z1JnRkszaVpseGI3TWRkVGozR1lZM3EiLCJodHRwczovL2F0bGFzc2lhbi5jb20vc3lzdGVtQWNjb3VudEVtYWlsRG9tYWluIjoiY29ubmVjdC5hdGxhc3NpYW4uY29tIn0.czxiKfybhjhx_V3e8AiZo-O40cL3y5QpCf_ftdLO0mDcfQaXFY1bDpbYKCPnsmRk3uV8SyGrjCvkYlVKeobkuOLo5Zbj58Ni6wWpuyfvhPF5XKVXso6KW7fx4MK8r8Qfb6eI-qVO1VB8kbtgpHWNXwN1hXtA7iE6pYMYxm5x5Co83DNuhGQPFQIaLSdoBL06IHah7jqdDGAauru0UvQiGWxdDfevlqg8xdaPiCjztfCWp8P0dMELtkCk3bNyU0ZUnpR7wLkGuNszVHWH3Jk2Jr4Ibdwibn1R088VuwndvsfYr5lqfUPRLSjy7nXLfKfyKrslyjvESQjpx4dubX0LLg"
# integrations = Integrations(token=token).download_jira_attachments(issue_key="SCRUM-4")
# print(integrations)



