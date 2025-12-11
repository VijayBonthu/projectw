from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser, StrOutputParser
from langchain.output_parsers import OutputFixingParser
from config import settings
from utils.prompts import Requirements_analyzer_prompt, Ambiguity_Resolver_Prompt, Validator_agent_prompt, midway_ba_report_prompt, Solution_Architect_Agent_Prompt, Critic_Agent_Prompt,Evidence_Gatherer_Agent_prompt, feasibility_estimator_prompt, Report_Generator_Prompt, SUMMARIZE_CHATCONVERSATION_PROMPT, SUMMARIAZE_MAIN_REPORT_PROMPT
import json


llm = ChatOpenAI(api_key=settings.OPENAI_CHATGPT, model=settings.GENERATING_REPORT_MODEL,reasoning_effort="low")
llm_parser = ChatOpenAI(api_key=settings.OPENAI_CHATGPT, model=settings.SUMMARIZATION_MODEL, temperature=0)
fixed_parser = OutputFixingParser.from_llm(parser=JsonOutputParser(), llm=llm_parser)

async def requirements_analyzer(docs:list) -> dict:
    req_analyzer_prompt =  ChatPromptTemplate.from_template(Requirements_analyzer_prompt)
    parser = JsonOutputParser()
    chain = req_analyzer_prompt | llm | fixed_parser
    input_dict = {"requirements_text": docs}
    response = await chain.ainvoke(input_dict)
    return response

async def ambiguity_resolver(req_analyzer_json, raw_document, process_flow, org_policies ) -> dict:
    amb_resolver_prompt =  ChatPromptTemplate.from_template(Ambiguity_Resolver_Prompt)
    parser = JsonOutputParser()
    chain = amb_resolver_prompt | llm | parser
    input_dict = {"requirements_json": json.dumps(req_analyzer_json),
                  "raw_document": json.dumps(raw_document),
                  "process_flow":json.dumps(process_flow),
                  "org_policies":json.dumps(org_policies)
                  }
    print("starting ambiguity resolution")
    response = await chain.ainvoke(input_dict)
    return response

async def validator_agent(req_analyzer_json:dict, amb_resolver_json:dict) -> dict:
    valid_agent_prompt = ChatPromptTemplate.from_template(Validator_agent_prompt)
    parser = JsonOutputParser()
    chain = valid_agent_prompt | llm | fixed_parser
    input_dict = {"requirements_json": json.dumps(req_analyzer_json),
                  "clarified_assumptions": json.dumps(amb_resolver_json)
                  }
    response = await chain.ainvoke(input_dict)
    return response

async def midway_report(req_analyzer_json:dict, amb_resolver_json:dict, validator_json:dict) -> str:
    mid_way_report_prompt = ChatPromptTemplate.from_template(midway_ba_report_prompt)
    parser = StrOutputParser()
    chain = mid_way_report_prompt | llm | parser
    input_dict = {"requirements_analyzer": json.dumps(req_analyzer_json),
                  "ambiguity_resolver": json.dumps(amb_resolver_json),
                  "validator":json.dumps(validator_json)
                  }
    response = await chain.ainvoke(input_dict)
    return response
    
async def solution_architect(req_analyzer_json:dict, amb_resolver_json:dict, validator_json:dict, critic_feedback:dict) -> dict:
    sol_architecture_prompt = ChatPromptTemplate.from_template(Solution_Architect_Agent_Prompt)
    parser = JsonOutputParser()
    chain = sol_architecture_prompt | llm | fixed_parser
    input_dict = {"requirements_json": json.dumps(req_analyzer_json),
                  "clarified_assumptions": json.dumps(amb_resolver_json),
                  "validated_requirements":json.dumps(validator_json),
                  "critic_feedback": json.dumps(critic_feedback)
                  }
    response = await chain.ainvoke(input_dict)
    return response

async def evidence_gather_agent(recommendations_json:dict, validated_requirements_json:dict, solution_architectures:dict) -> dict:
    evi_gather_prompt = ChatPromptTemplate.from_template(Evidence_Gatherer_Agent_prompt)
    parser = JsonOutputParser()
    chain = evi_gather_prompt | llm | fixed_parser
    input_dict = {"requirements_json": json.dumps(recommendations_json),
                  "validated_requirements": json.dumps(validated_requirements_json),
                  "solution_architectures": json.dumps(solution_architectures)
                  }
    response = await chain.ainvoke(input_dict)
    return response

async def critic_agent(req_analyzer_json:dict, validator_json:dict, solution_architectures_json:dict, previous_critic_feedback:dict) -> dict:
    cric_agent_prompt = ChatPromptTemplate.from_template(Critic_Agent_Prompt)
    chain = cric_agent_prompt | llm | fixed_parser
    input_dict = {"requirements_json": json.dumps(req_analyzer_json),
                "validated_requirements": json.dumps(validator_json),
                "solution_architectures": json.dumps(solution_architectures_json),
                "previous_critic_feedback": json.dumps(previous_critic_feedback)
                    }
    response = await chain.ainvoke(input_dict)
    return response

async def feasibility_estimator(req_analyzer_json:dict, validator_json:dict, solution_architectures_json:dict, evidence_gather_json:dict) -> dict:
    feas_estimator_prompt = ChatPromptTemplate.from_template(feasibility_estimator_prompt)
    parser = JsonOutputParser()
    chain = feas_estimator_prompt | llm | fixed_parser
    input_dict = {"requirements_json": json.dumps(req_analyzer_json),
                  "validated_requirements":json.dumps(validator_json),
                  "solution_architectures": json.dumps(solution_architectures_json),
                  "evidence_json": json.dumps(evidence_gather_json)
                  }
    response = await chain.ainvoke(input_dict)
    return response

async def ba_final_report_generation(requirements_json:dict,validated_requirements:dict,ambiguity_resolutions:dict, solution_architectures:dict, critic_feedback:dict, evidence:dict, feasibility:dict):
    final_report_prompt = ChatPromptTemplate.from_template(Report_Generator_Prompt)
    parser = StrOutputParser()
    chain = final_report_prompt | llm | parser
    input_dict = {
        "requirements_analysis_json": json.dumps(requirements_json),
        "validated_requirements": json.dumps(validated_requirements),
        "ambiguity_resolver_json": json.dumps(ambiguity_resolutions),
        "solution_architect_json": json.dumps(solution_architectures),
        "critic_feedback_json": json.dumps(critic_feedback),
        "evidence_gathering_json":json.dumps(evidence),
        "feasibility_estimator_json": json.dumps(feasibility)
    }
    response = await chain.ainvoke(input_dict)
    return response

async def conversational_summary(chat_history:list, main_report_summary:str) -> str:
    convo_summary = ChatPromptTemplate.from_template(SUMMARIZE_CHATCONVERSATION_PROMPT)
    parser = StrOutputParser()
    chain = convo_summary | llm_parser | parser
    input_dict = {
        "chat_history": json.dumps(chat_history),
        "main report_summary": main_report_summary
    }

    response = await chain.ainvoke(input_dict)
    return response

async def main_report_summary(main_report:str) -> str:
    main_summary = ChatPromptTemplate.from_template(SUMMARIAZE_MAIN_REPORT_PROMPT)
    parser = JsonOutputParser()
    chain = main_summary | llm_parser | parser
    input_dict = {
        "full_report_markdown": main_report
    }
    response = await chain.ainvoke(input_dict)
    return response

