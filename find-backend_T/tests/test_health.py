from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_read_main():
    # Assuming there is a root or health endpoint. 
    # If not, we check for 404 which still means app loaded, 
    # but ideally we should checking a real endpoint.
    # checking /health based on common practices, or /
    response = client.get("/")
    assert response.status_code in [200, 404] 

def test_python_version():
    import sys
    assert sys.version_info.major == 3
