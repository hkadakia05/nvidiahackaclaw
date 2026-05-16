# verifier agent
# checks output quality before accepting expensive results

try:
    from langchain_core.output_parsers import StrOutputParser
    from langchain_core.prompts import ChatPromptTemplate
except ImportError:
    ChatPromptTemplate = None
    StrOutputParser = None


class VerifyingAgent:

    def __init__(self, llm):

        self.name = "verifying-agent"
        self.llm = llm

        if ChatPromptTemplate is None or StrOutputParser is None:
            self.chain = None
            return

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

        if self.chain is None:
            result = self.llm.invoke({"response": response})
        else:
            result = self.chain.invoke({
                "response": response
            })

        print(f"\n[VERIFIER RESULT]\n{result}")

        return result
