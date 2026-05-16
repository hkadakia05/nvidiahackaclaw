import asyncio
import json
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional

from sqlalchemy.orm import Session
from fastapi import WebSocket

from app import models
from app.run_manager import save_and_send_event, event_to_websocket_payload
from brain.ag.agents.planningag import PlanningAgent
from brain.ag.agents.budgetingag import BudgetingAgent
from brain.ag.agents.gpurtag import GPURouterAgent
from brain.ag.agents.verifyingag import VerifyingAgent
from app.nemotron_wrapper import NemotronWrapper


class AgentOrchestrator:
    def __init__(self):
        # Initialize agents
        self.planning_agent = PlanningAgent(llm=None)  # Will be initialized with real LLM
        self.budgeting_agent = BudgetingAgent()
        self.gpu_router_agent = GPURouterAgent()
        self.verifying_agent = VerifyingAgent(llm=None)  # Will be initialized with real LLM
        self.nemotron_wrapper = NemotronWrapper()
        
    async def run_orchestration_pipeline(self, db: Session, websocket: WebSocket, run_id: str, task: str) -> bool:
        """
        Run the full agent orchestration pipeline:
        1. Planning agent
        2. Budget optimizer
        3. GPU router
        4. Cost estimator
        5. Verifier
        """
        try:
            # Step 1: Planning Agent using Nemotron
            await save_and_send_event(
                db, websocket, run_id, "agent_planning", 
                "Planning agent created an execution plan using Nemotron",
                details={"agent": "planning-agent", "task": task}
            )
            
            # Get the plan from planning agent using Nemotron
            planning_prompt = f"""
            Break this task into efficient execution steps:
            
            Task: {task}
            
            Please provide a detailed plan with:
            1. Clear step-by-step breakdown
            2. Estimated resource requirements
            3. Potential challenges
            """
            
            plan_result = await self.nemotron_wrapper.call_nemotron(planning_prompt)
            
            if plan_result["success"]:
                plan = plan_result["data"]["choices"][0]["message"]["content"]
            else:
                # Fallback to simple plan if Nemotron fails
                plan = f"Simple plan for task: {task}"
                await save_and_send_event(
                    db, websocket, run_id, "security_warning", 
                    "Nemotron API call failed, using fallback plan",
                    details={"error": plan_result["error"]}
                )
            
            # Step 2: Budget Optimization
            await save_and_send_event(
                db, websocket, run_id, "model_reasoning", 
                "Budget optimizer analyzing GPU costs",
                details={"agent": "budgeting-agent", "plan": plan}
            )
            
            # For demo purposes, we'll simulate some GPU costs
            # In real implementation, this would be more sophisticated
            gpu_costs = [50, 30, 20]  # Simulated costs for different steps
            
            # Step 3: GPU Routing
            await save_and_send_event(
                db, websocket, run_id, "gpu_metric", 
                "GPU router selecting compute paths",
                details={"agent": "gpu-router-agent", "plan": plan}
            )
            
            routes = []
            approved_steps = []
            
            # Process each step in the plan
            for i, cost in enumerate(gpu_costs):
                await save_and_send_event(
                    db, websocket, run_id, "model_reasoning", 
                    f"Processing step {i+1} of the plan",
                    details={"agent": "gpu-router-agent", "step": i+1, "cost": cost}
                )
                
                # Route the task
                route = self.gpu_router_agent.route_task(f"Step {i+1}: {task}")
                routes.append(route)
                
                # Check budget
                approved = self.budgeting_agent.approve_gpu_usage(cost)
                approved_steps.append(approved)
                
                await save_and_send_event(
                    db, websocket, run_id, "gpu_metric", 
                    f"GPU route selected: {route}",
                    details={"agent": "gpu-router-agent", "route": route, "approved": approved, "cost": cost}
                )
                
                if not approved:
                    await save_and_send_event(
                        db, websocket, run_id, "security_warning", 
                        f"Budget exceeded for step {i+1}",
                        details={"agent": "budgeting-agent", "step": i+1, "cost": cost}
                    )
                    return False  # Stop if budget exceeded
                    
            # Step 4: Cost Estimation (simulated)
            await save_and_send_event(
                db, websocket, run_id, "gpu_metric", 
                "Cost estimation completed",
                details={"agent": "cost-estimator", "total_cost": sum(gpu_costs)}
            )
            
            # Step 5: Verifier using Nemotron
            await save_and_send_event(
                db, websocket, run_id, "model_reasoning", 
                "Verifier checking final output quality using Nemotron",
                details={"agent": "verifying-agent", "plan": plan}
            )
            
            # Verify the final output using Nemotron
            verification_prompt = f"""
            Verify whether this response is acceptable and complete:
            
            Task: {task}
            Response: {plan}
            
            Please evaluate:
            1. Completeness of the plan
            2. Logical flow
            3. Resource requirements
            4. Potential issues
            """
            
            verification_result = await self.nemotron_wrapper.call_nemotron(verification_prompt)
            
            if verification_result["success"]:
                verification_text = verification_result["data"]["choices"][0]["message"]["content"]
            else:
                # Fallback to simple verification if Nemotron fails
                verification_text = "Verification completed (fallback)"
                await save_and_send_event(
                    db, websocket, run_id, "security_warning", 
                    "Nemotron API call failed for verification, using fallback",
                    details={"error": verification_result["error"]}
                )
            
            await save_and_send_event(
                db, websocket, run_id, "model_reasoning", 
                "Verification completed",
                details={"agent": "verifying-agent", "result": verification_text}
            )
            
            # Final step
            await save_and_send_event(
                db, websocket, run_id, "final_answer", 
                "Orchestration pipeline completed successfully",
                details={"agent": "orchestrator", "plan": plan, "verification": verification_text}
            )
            
            return True
            
        except Exception as e:
            await save_and_send_event(
                db, websocket, run_id, "run_failed", 
                f"Orchestration pipeline failed: {str(e)}",
                details={"error": str(e)}
            )
            return False


# Create a global orchestrator instance
orchestrator = AgentOrchestrator()


async def run_agent_orchestration(db: Session, websocket: WebSocket, run_id: str, task: str) -> bool:
    """
    Run the agent orchestration pipeline.
    This is the function that will replace the fake timeline in run_manager.py
    """
    return await orchestrator.run_orchestration_pipeline(db, websocket, run_id, task)