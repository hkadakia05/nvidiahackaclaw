#planning agent 
# planning agent

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser


class PlanningAgent:

    def __init__(self, llm):

        self.name = "planning-agent"

        self.prompt = ChatPromptTemplate.from_template(
            """
            Break this task into efficient execution steps.

            Task:
            {task}
            """
        )

        self.chain = (
            self.prompt
            | llm
            | StrOutputParser()
        )

    def create_plan(self, task):

        print(f"\n[PLANNER] analyzing task: {task}")

        result = self.chain.invoke({
            "task": task
        })

        print(f"\n[PLANNER OUTPUT]\n{result}")

        return result