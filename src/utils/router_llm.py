from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from config import settings
from utils.prompts import ROUTER_LLM_PROMPT, SUMMARIZE_CHATCONVERSATION_PROMPT
from langchain_core.output_parsers import JsonOutputParser
import tiktoken

llm_router = ChatOpenAI(api_key=settings.OPENAI_CHATGPT, model=settings.SUMMARIZATION_MODEL, temperature=0)
async def router_query_llm(user_message:str, conversation_summary:dict, report_summary:dict) -> str:
    router_prompt = ChatPromptTemplate.from_template(ROUTER_LLM_PROMPT)
    parser = JsonOutputParser()
    chain = router_prompt | llm_router | parser
    input_dict = {"report_summary": report_summary,
                  "conversation_summary": conversation_summary,
                  "user_message": user_message
                  }
    response = await chain.ainvoke(input_dict)
    return response

async def conversation_summary_llm(conversation:list[dict]) -> str:
    summary_prompt = ChatPromptTemplate.from_template(SUMMARIZE_CHATCONVERSATION_PROMPT)
    parser = JsonOutputParser()
    chain = summary_prompt | llm_router | parser
    input_dict = {"conversation": conversation}
    response = await chain.ainvoke(input_dict)
    return response

async def count_token(data:list[dict]) -> int:
    encoding = tiktoken.encoding_for_model(settings.SUMMARIZATION_MODEL)
    total_tokens = 0
    for message in data:
        total_tokens += len(encoding.encode(message["role"]))
        total_tokens += len(encoding.encode(message["content"]))
    return total_tokens
