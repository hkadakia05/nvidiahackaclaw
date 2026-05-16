# planning agent

try:
    from langchain_core.output_parsers import StrOutputParser
    from langchain_core.prompts import ChatPromptTemplate
except ImportError:
    ChatPromptTemplate = None
    StrOutputParser = None


class PlanningAgent:

    def __init__(self, llm):

        self.name = "planning-agent"
        self.llm = llm

        if ChatPromptTemplate is None or StrOutputParser is None:
            self.chain = None
            return

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

        if self.chain is None:
            result = self.llm.invoke({"task": task})
        else:
            result = self.chain.invoke({
                "task": task
            })

        print(f"\n[PLANNER OUTPUT]\n{result}")

        return result
