#budgeting agent 
# budgeting agent
# prevents excessive gpu usage

class BudgetingAgent:

    def __init__(self):

        self.name = "budgeting-agent"

        self.daily_gpu_budget = 100
        self.current_gpu_usage = 0

    def approve_gpu_usage(self, cost):

        print(f"\n[BUDGET AGENT] requested gpu cost: {cost}")

        projected_total = (
            self.current_gpu_usage + cost
        )

        if projected_total > self.daily_gpu_budget:

            print(
                "[BUDGET AGENT] gpu request denied"
            )

            return False

        self.current_gpu_usage += cost

        print(
            "[BUDGET AGENT] gpu request approved"
        )

        print(
            f"[BUDGET AGENT] current usage: {self.current_gpu_usage}"
        )

        return True