import os
import asyncio
import aiohttp
from typing import Dict, Any, Optional

class NemotronWrapper:
    def __init__(self):
        # Get the API key from environment variables
        self.api_key = os.getenv("NVIDIA_API_KEY")
        if not self.api_key:
            raise ValueError("NVIDIA_API_KEY environment variable not set")
        
        # Base URL for NVIDIA API
        self.base_url = "https://build.nvidia.com"
        
    async def call_nemotron(self, prompt: str, model: str = "nemotron-4") -> Dict[str, Any]:
        """
        Call the NVIDIA Nemotron API with the given prompt.
        
        Args:
            prompt (str): The prompt to send to the model
            model (str): The model to use (default: nemotron-4)
            
        Returns:
            Dict[str, Any]: The API response
        """
        if not self.api_key:
            raise ValueError("NVIDIA API key not configured")
            
        url = f"{self.base_url}/v1/chat/completions"
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.7,
            "max_tokens": 1024
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers, json=payload) as response:
                    if response.status == 200:
                        result = await response.json()
                        return {
                            "success": True,
                            "data": result,
                            "model": model
                        }
                    else:
                        return {
                            "success": False,
                            "error": f"API call failed with status {response.status}",
                            "status_code": response.status
                        }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def get_model_info(self, model: str = "nemotron-4") -> Dict[str, Any]:
        """
        Get information about a specific model.
        
        Args:
            model (str): The model name
            
        Returns:
            Dict[str, Any]: Model information
        """
        # This would typically be a call to get model details
        # For now, we'll return mock information
        return {
            "model": model,
            "provider": "NVIDIA",
            "status": "available",
            "description": "NVIDIA Nemotron model for advanced reasoning"
        }

# Create a global instance
nemotron_wrapper = NemotronWrapper()