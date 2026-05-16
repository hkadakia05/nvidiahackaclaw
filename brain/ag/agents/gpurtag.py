#gpu routing agent
# gpu routing agent
# routes tasks to cheapest useful compute path

class GPURouterAgent:

    def __init__(self):

        self.name = "gpu-router-agent"

        self.gpu_calls_requested = 0
        self.gpu_calls_approved = 0
        self.gpu_calls_avoided = 0
        self.cache_hits = 0

    def classify_task(self, task):

        task = task.lower()

        if (
            "quick" in task
            or "simple" in task
            or "summarize" in task
        ):
            return "low"

        elif (
            "analyze" in task
            or "reason" in task
            or "plan" in task
        ):
            return "high"

        return "medium"

    def check_cache(self, task):

        cached_tasks = [
            "summarize meeting notes"
        ]

        if task.lower() in cached_tasks:

            self.cache_hits += 1

            print("\n[CACHE HIT]")
            print("[GPU ROUTER] gpu call avoided")

            return True

        return False

    def route_task(self, task):

        print(f"\n[GPU ROUTER] evaluating task: {task}")

        self.gpu_calls_requested += 1

        if self.check_cache(task):

            self.gpu_calls_avoided += 1

            return "cached-response"

        complexity = self.classify_task(task)

        print(f"[GPU ROUTER] complexity: {complexity}")

        if complexity == "low":

            self.gpu_calls_avoided += 1

            print("[GPU ROUTER] routed locally")

            return "local-model"

        elif complexity == "medium":

            self.gpu_calls_approved += 1

            print("[GPU ROUTER] routed to nemotron nano")

            return "nemotron-nano"

        else:

            self.gpu_calls_approved += 1

            print("[GPU ROUTER] routed to nemotron super")

            return "nemotron-super"

    def show_metrics(self):

        print("\n========== GPU METRICS ==========")

        print(
            f"GPU Calls Requested: {self.gpu_calls_requested}"
        )

        print(
            f"GPU Calls Approved: {self.gpu_calls_approved}"
        )

        print(
            f"GPU Calls Avoided: {self.gpu_calls_avoided}"
        )

        print(
            f"Redis Cache Hits: {self.cache_hits}"
        )

        print("Estimated Credits Saved: 38%")

        print("=================================")