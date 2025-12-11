from typing_extensions import TypedDict, List, Union
from typing import Annotated
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from .agentic_workflow import requirements_analyzer, ambiguity_resolver, validator_agent, midway_report, solution_architect, critic_agent, evidence_gather_agent, feasibility_estimator, ba_final_report_generation
from langchain_core.messages import AIMessage, HumanMessage
import asyncio
from utils.writing_to_file import write_to_file 

def update_or_append(state, agent_name, response):
    for i, item in enumerate(state['req_analysis']):
        if item['agent'] == agent_name:
            state['req_analysis'][i]['output'] = response
            return
    # If agent not found, append it
    state['req_analysis'].append({"agent": agent_name, "output": response})

class AgentState(TypedDict):
    document:list[str]
    req_analysis: List[dict]
    loop_count:int
    message:List[Union[AIMessage, HumanMessage]]

async def req_analyse_node(state:AgentState) -> AgentState:
    response = await requirements_analyzer(state['document'])
    update_or_append(state, "requirements_analyzer", response)
    print("req_analyse_node done")
    return state

async def amb_resolve_node(state:AgentState) -> AgentState:
    req_analyze_json = next(item["output"] for item in state['req_analysis'] if item['agent'] == 'requirements_analyzer')
    raw_document = state["document"]
    process_flow = next((item["output"].get("process_flow") for item in state['req_analysis'] if item['agent'] == 'requirements_analyzer'), "N/A")
    org_policies = state.get("org_policies", "N/A")

    try:
        response = await ambiguity_resolver(req_analyzer_json=req_analyze_json,raw_document=raw_document, process_flow=process_flow, org_policies=org_policies)

        print("amb_resolve_node done")
        update_or_append(state, "ambiguity_resolver", response)
        return state
    except Exception as e:
        print(f"Error in ambiguity_resolver: {e}")
        raise e
    

async def validator_node(state:AgentState) -> AgentState:
    requirements = next(item["output"] for item in state['req_analysis'] if item['agent'] == 'requirements_analyzer')
    assumptions = next(item["output"] for item in state['req_analysis'] if item['agent'] == 'ambiguity_resolver')
    response = await validator_agent(req_analyzer_json=requirements, amb_resolver_json=assumptions)
    print("validator_node done")
    update_or_append(state, "validator_agent", response)
    return state

async def midway_report_node(state:AgentState) -> AgentState:
    requirements = next(item["output"] for item in state['req_analysis'] if item['agent'] == 'requirements_analyzer')
    assumptions = next(item["output"] for item in state['req_analysis'] if item['agent'] == 'ambiguity_resolver')
    validators = next(item["output"] for item in state['req_analysis'] if item['agent'] == 'validator_agent')
    response = await midway_report(req_analyzer_json=requirements, amb_resolver_json=assumptions, validator_json=validators)
    state['message'].append(AIMessage(content=response))
    print(f"Midway Report done")
    return state

async def solution_architectures_node(state:AgentState) -> AgentState:
    requirements = next(item["output"] for item in state['req_analysis'] if item['agent'] == 'requirements_analyzer')
    amb_resolver_json = next(item["output"] for item in state['req_analysis'] if item['agent'] == 'ambiguity_resolver')
    validators = next(item["output"] for item in state['req_analysis'] if item['agent'] == 'validator_agent')
    critic_feedback = next((item["output"] for item in state['req_analysis'] if item['agent'] == 'critic_agent'), "N/A")
    response = await solution_architect(req_analyzer_json=requirements, amb_resolver_json=amb_resolver_json,
                                             validator_json=validators, critic_feedback=critic_feedback)
    print("solution_architectures_node done")
    update_or_append(state, "solution_architectures", response)
    return state

async def evidence_gather_node(state:AgentState) -> AgentState:
    requirements = next(item["output"] for item in state['req_analysis'] if item['agent'] == 'requirements_analyzer')
    validators = next(item["output"] for item in state['req_analysis'] if item['agent'] == 'validator_agent')
    sol_architecture = next(item["output"] for item in state['req_analysis'] if item['agent'] == 'solution_architectures')
    response = await evidence_gather_agent(recommendations_json=requirements, validated_requirements_json=validators, solution_architectures=sol_architecture)
    update_or_append(state, "evidence_gather_agent", response)
    print("evidence_gather_node done")
    return state

async def critic_node(state:AgentState) -> AgentState:
    requirements = next(item["output"] for item in state['req_analysis'] if item['agent'] == 'requirements_analyzer')
    validators = next(item["output"] for item in state['req_analysis'] if item['agent'] == 'validator_agent')
    solution_architectures = next(item["output"] for item in state['req_analysis'] if item['agent'] == 'solution_architectures')
    previous_critic_feedback = next((item["output"] for item in state['req_analysis'] if item['agent'] == 'critic_agent'), "N/A")
    response = await critic_agent(req_analyzer_json= requirements, validator_json=validators, solution_architectures_json=solution_architectures, previous_critic_feedback=previous_critic_feedback)
    update_or_append(state, "critic_agent", response)
    print("critic_node done")
    state["loop_count"] = state.get("loop_count", 0) + 1
    print(f"critic_node done, loop_count={state['loop_count']}")
    return state

def critic_to_alternative_loop(state:AgentState):
    critic_feedback = next(item["output"] for item in state['req_analysis'] if item['agent'] == 'critic_agent')
    loop_back_required = critic_feedback.get("major_blockers", False)

    if loop_back_required and state.get("loop_count", 0)< 3: 
        return "continue_loop"
    else:
        state["loop_count"] = 0
        return "end_loop"

async def feasibility_estimator_node(state:AgentState) -> AgentState:
    requirements = next(item["output"] for item in state['req_analysis'] if item['agent'] == 'requirements_analyzer')
    validators = next(item["output"] for item in state['req_analysis'] if item['agent'] == 'validator_agent')
    solution_architectures = next(item["output"] for item in state['req_analysis'] if item['agent'] == 'solution_architectures')
    evidence_gathered = next(item["output"] for item in state['req_analysis'] if item['agent'] == 'evidence_gather_agent')
    response = await feasibility_estimator(req_analyzer_json=requirements,
                                           validator_json=validators, solution_architectures_json=solution_architectures,
                                           evidence_gather_json=evidence_gathered)
    print("feasibility_estimator_node done")
    update_or_append(state, "feasibility_estimator", response)
    await write_to_file("output/state_data.json", str(state))
    return state

async def ba_final_report_node(state: AgentState)-> AgentState:
    requirements = next(item["output"] for item in state['req_analysis'] if item['agent'] == 'requirements_analyzer')
    validators = next(item["output"] for item in state['req_analysis'] if item['agent'] == 'validator_agent')
    ambiguity_resolver_json = next(item["output"] for item in state['req_analysis'] if item['agent'] == 'ambiguity_resolver')
    solution_architectures = next(item["output"] for item in state['req_analysis'] if item['agent'] == 'solution_architectures')
    critic_feedback_json = next(item["output"] for item in state['req_analysis'] if item['agent'] == 'critic_agent')
    evidence_gathered = next(item["output"] for item in state['req_analysis'] if item['agent'] == 'evidence_gather_agent')
    feasibility_json = next(item["output"] for item in state['req_analysis'] if item['agent'] == 'feasibility_estimator')
    response = await ba_final_report_generation(requirements_json=requirements, validated_requirements=validators, ambiguity_resolutions=ambiguity_resolver_json, solution_architectures=solution_architectures,
                                                critic_feedback=critic_feedback_json, evidence=evidence_gathered, feasibility=feasibility_json)
    state['message'].append(AIMessage(content=response))
    print(f"final_report: {state['message'][-1]}")
    await write_to_file("output/final_report.md", str(state["message"][-1].content))
    print("final report is created")
    return state
    

       

graph = StateGraph(AgentState)
graph.add_node("req_analyse_node", req_analyse_node)
graph.add_node("amb_resolve_node", amb_resolve_node)
graph.add_node("validator_node", validator_node)
graph.add_node("midway_report_node", midway_report_node)
graph.add_node("solution_architectures_node", solution_architectures_node)
graph.add_node("critic_node", critic_node)
graph.add_node("evidence_gather_node", evidence_gather_node)
graph.add_node("feasibility_estimator_node", feasibility_estimator_node)
graph.add_node("ba_final_report_node", ba_final_report_node)


graph.add_edge(START,"req_analyse_node")
graph.add_edge("req_analyse_node", "amb_resolve_node")
graph.add_edge("amb_resolve_node", "validator_node")
graph.add_edge("validator_node", "solution_architectures_node")
graph.add_edge("solution_architectures_node", "critic_node")
graph.add_conditional_edges(
    "critic_node",
    critic_to_alternative_loop,
    {
        "continue_loop": "solution_architectures_node",
        "end_loop": "evidence_gather_node"
    }
)
graph.add_edge("evidence_gather_node", "feasibility_estimator_node")
graph.add_edge("feasibility_estimator_node", "ba_final_report_node")
graph.add_edge("ba_final_report_node", END)
agent = graph.compile()

async def run_agent_pipeline(document: list[str]) -> AgentState:
    initial_state: AgentState = {
        "document":document,
        'req_analysis':[],
        "loop_count":0,
        "message":[]
    }
    return await agent.ainvoke(initial_state)

# async def main():

#     result = await agent.ainvoke({"document": ["""Company enercare wants to automate their post call analytics for call quality assurance of their customer service call where customer calls for their queries.

# We have to automate the entire post call quality, the calls are being stored with the vendor and we can pull the calls as needed and convert them.

# there will be handled in batch processing and not in real time.

# agent receives the call and they have a solution finder which provided them the steps-by-step guidence on how to answer customer query and what documents they have to refer to inorder to answer the user questions.

# The solution finder bascially lets them navigate a decision tree based on the query agents will ask follow up question and refer the documents to answer the customer queries. They have provided us with the dump in a excel of all the paths and their corresponding steps.

# They have about 2000+ documents which might be needed to answer the user questions along with compliance details of how the call should proceed.

# We need to use these documents based on the necessacity and use it for downstream purposes, so that means we have to use these documents along with the call transcripts to understand what needs to be done next.

# example call: once a call is received, agent with confirm user details and validate them against internal tools, based on the user query the call with be divided into 20 different categories which are mentioned in the solution finder and example customer call for HVAC issue, then the call is about HVAC issue and going down the solution finder will give agent to either ask follow up questions which either will give agent more details or it will ask to refer a document which is in those 2000+ document. refering the document will give the answers to user query or process to do the needful step if they couldnt resolve so either send the technician to fix it. and all these details will be logged into different systems.

# QA team will randomly get assigned to a call, where they have to score the call using a metric call CURE and provide a score to, so QA team listens to the call and checks if the agent verfied the customer, checked all the internal/third party tools like clarify, talesin, zoro etc which are used for customer details, call logs, prolicies and billing and sending a technicians.

# QA jobs is to rate the call and  validate all the details. The solution needs to automate this process, the automation can run once every 24 hours or something but random calls needs to be scored follow the document and all the tools and solution finder and rate the agents and provide the metric on the dashboard so that they can improve their customer service

# to calculate the CURE score , C is call connect in which you check the diariazed conversation between agent and customer to see if they are connect well, greeting etc. U is understand to see the agent understood customer issue correctly and checked all the details in the system to see what equipment he hold, policy and protection plan etc from their internal tools. R is resolve where if the customer resolve the issue by following the 2000+ policy, procedures and product details to resolve the issue along with also checks if the agent has taken the right call notes and what all he verified etc, E is excite he ends the user call perfectly.

# They want us to build the solution which automte the entire quality assurance process and rate the agents and these metrics needs to be shown in the dashboard. like the CURE score which is connect, understand, resolve and excite. they will provide us with the metric at the later stages but they have thier criteria on how we can calculate the score. each part of the CURE as different criterias and they can be completed by reading the audio transcript and how well the agent assist the user over the call.

# They want us to build the end to end application which get the audio recording, diariaze it, use the documents and solution finder decision tree to rate the cure and give all these metric in a dashboard so that they can visualize which can drive the value or process changes requried to support the customers.

# They want this to be built in azure using microsoft fabric since they already have some modules built in fabric.

# they also want a chatbot which can answer questions inbuilt in the powerbi, example why this agent score is less compare to  others, then this chatbot can check all the metrics and provide them with the answers."""],
#                                   "req_analysis":[],
#                                   "message":[],
#                                   "loop_count":0})

# if __name__ == "__main__":
#     asyncio.run(main())