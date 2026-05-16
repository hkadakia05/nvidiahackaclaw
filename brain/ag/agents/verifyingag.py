#verifiying agent 
# verifier agent
# checks output quality before accepting expensive results

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser


class VerifyingAgent:

    def __init__(self, llm):

        self.name = "verifying-agent"

        self.prompt = ChatPromptTemplate.from_template(
            """
            Verify whether this response is acceptable.

            Response:
            {response}

            Return:
            APPROVED or REJECTED
            """
        )

        self.chain = (
            self.prompt
            | llm
            | StrOutputParser()
        )

    def verify_response(self, response):

        print("\n[VERIFIER] checking output")

        result = self.chain.invoke({
            "response": response
        })

        print(f"\n[VERIFIER RESULT]\n{result}")

        return result