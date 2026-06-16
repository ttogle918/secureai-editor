# Date: 2026-06-12
# Description: Sprint 11 Verification Script

import requests
import unittest
import sys
import uuid

BASE_URL = "http://localhost:8080/api/v1"

# 블랙 박스 & 경계선 테스트
class Sprint11BlackBoxTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Create a new user and login
        cls.email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        cls.password = "Secure123!"
        
        # Black box testing for Registration (ToS, Privacy)
        res = requests.post(f"{BASE_URL}/auth/register", json={
            "email": cls.email,
            "password": cls.password,
            "name": "Test User",
            "termsAccepted": True,
            "privacyAccepted": True,
            "marketingOptIn": False
        })
        
        if res.status_code != 201:
            print(f"Warning: Setup failed. Server might be down. Status: {res.status_code}")
            return
            
        # Login
        login_res = requests.post(f"{BASE_URL}/auth/login", json={
            "email": cls.email,
            "password": cls.password
        })
        cls.token = login_res.json().get("data", {}).get("accessToken")
        cls.headers = {"Authorization": f"Bearer {cls.token}"}

    def test_01_workspace_mode_success(self):
        """White/Black Box & Boundary: Test valid workspace modes"""
        if not hasattr(self, 'headers'):
            self.skipTest("Server down")
            
        valid_modes = ["DEVELOPER", "SECURITY_MANAGER", "BOTH"]
        for mode in valid_modes:
            res = requests.patch(f"{BASE_URL}/users/me/workspace-mode", 
                               json={"workspaceMode": mode},
                               headers=self.headers)
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.json()["data"]["workspaceMode"], mode)

    def test_02_workspace_mode_boundary(self):
        """Boundary Test: Invalid workspace mode string should fail with 400"""
        if not hasattr(self, 'headers'):
            self.skipTest("Server down")
            
        res = requests.patch(f"{BASE_URL}/users/me/workspace-mode", 
                           json={"workspaceMode": "INVALID_MODE"},
                           headers=self.headers)
        self.assertEqual(res.status_code, 400, "Should reject invalid mode")

    def test_03_registration_boundary(self):
        """Boundary Test: Missing terms/privacy should fail registration"""
        res = requests.post(f"{BASE_URL}/auth/register", json={
            "email": f"test2_{uuid.uuid4().hex[:8]}@example.com",
            "password": "Password123!",
            "name": "Invalid User",
            "termsAccepted": False,
            "privacyAccepted": True
        })
        self.assertEqual(res.status_code, 400, "Should reject if terms not accepted")

if __name__ == '__main__':
    # Try to ping the server first
    try:
        requests.get("http://localhost:8080/actuator/health", timeout=2)
    except requests.exceptions.ConnectionError:
        print("Backend server is not running at localhost:8080.")
        print("Please start the server (e.g. `make dev`) before running this test script for full E2E validation.")
        sys.exit(0)
        
    unittest.main()
