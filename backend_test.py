#!/usr/bin/env python3
"""
Comprehensive Backend Testing for Cineviax Application
Tests authentication, movie management, and TMDB search functionality
"""

import requests
import json
import time
from typing import Dict, Any, Optional

# Configuration
BACKEND_URL = "https://watchlist-organizer.preview.emergentagent.com/api"
TEST_USER_EMAIL = "testuser@cineviax.com"
TEST_USER_PASSWORD = "TestPassword123!"

class CineviaxTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.auth_token = None
        self.test_results = []
        self.created_movie_id = None
        
    def log_test(self, test_name: str, success: bool, message: str, details: Any = None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def make_request(self, method: str, endpoint: str, data: Dict = None, headers: Dict = None) -> tuple:
        """Make HTTP request and return response and success status"""
        url = f"{self.base_url}{endpoint}"
        default_headers = {"Content-Type": "application/json"}
        
        if headers:
            default_headers.update(headers)
            
        if self.auth_token and "Authorization" not in default_headers:
            default_headers["Authorization"] = f"Bearer {self.auth_token}"
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=default_headers, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, headers=default_headers, timeout=30)
            elif method.upper() == "PUT":
                response = requests.put(url, json=data, headers=default_headers, timeout=30)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=default_headers, timeout=30)
            else:
                return None, False
                
            return response, True
        except Exception as e:
            return str(e), False
    
    def test_signup(self) -> bool:
        """Test user signup functionality"""
        test_name = "User Signup"
        
        signup_data = {
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        }
        
        response, success = self.make_request("POST", "/signup", signup_data)
        
        if not success:
            self.log_test(test_name, False, f"Request failed: {response}")
            return False
        
        if response.status_code == 201 or response.status_code == 200:
            try:
                data = response.json()
                if "access_token" in data and "token_type" in data:
                    self.auth_token = data["access_token"]
                    self.log_test(test_name, True, "User created successfully with JWT token")
                    return True
                else:
                    self.log_test(test_name, False, "Missing token in response", data)
                    return False
            except Exception as e:
                self.log_test(test_name, False, f"Invalid JSON response: {e}", response.text)
                return False
        elif response.status_code == 400:
            # User might already exist, try login instead
            self.log_test(test_name, True, "User already exists (expected for repeated tests)")
            return self.test_login()
        else:
            self.log_test(test_name, False, f"Unexpected status code: {response.status_code}", response.text)
            return False
    
    def test_login(self) -> bool:
        """Test user login functionality"""
        test_name = "User Login"
        
        login_data = {
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        }
        
        response, success = self.make_request("POST", "/login", login_data)
        
        if not success:
            self.log_test(test_name, False, f"Request failed: {response}")
            return False
        
        if response.status_code == 200:
            try:
                data = response.json()
                if "access_token" in data and "token_type" in data:
                    self.auth_token = data["access_token"]
                    self.log_test(test_name, True, "Login successful with JWT token")
                    return True
                else:
                    self.log_test(test_name, False, "Missing token in response", data)
                    return False
            except Exception as e:
                self.log_test(test_name, False, f"Invalid JSON response: {e}", response.text)
                return False
        else:
            self.log_test(test_name, False, f"Login failed with status: {response.status_code}", response.text)
            return False
    
    def test_tmdb_search(self) -> Optional[Dict]:
        """Test TMDB search functionality"""
        test_name = "TMDB Search"
        
        if not self.auth_token:
            self.log_test(test_name, False, "No auth token available")
            return None
        
        response, success = self.make_request("GET", "/search/tmdb?query=inception")
        
        if not success:
            self.log_test(test_name, False, f"Request failed: {response}")
            return None
        
        if response.status_code == 200:
            try:
                data = response.json()
                if "results" in data and len(data["results"]) > 0:
                    movie = data["results"][0]  # Get first result
                    required_fields = ["tmdb_id", "title", "media_type"]
                    if all(field in movie for field in required_fields):
                        self.log_test(test_name, True, f"Found {len(data['results'])} results for 'inception'")
                        return movie
                    else:
                        self.log_test(test_name, False, "Missing required fields in search results", movie)
                        return None
                else:
                    self.log_test(test_name, False, "No search results found", data)
                    return None
            except Exception as e:
                self.log_test(test_name, False, f"Invalid JSON response: {e}", response.text)
                return None
        else:
            self.log_test(test_name, False, f"Search failed with status: {response.status_code}", response.text)
            return None
    
    def test_add_movie(self, movie_data: Dict) -> bool:
        """Test adding a movie to watchlist"""
        test_name = "Add Movie to Watchlist"
        
        if not self.auth_token:
            self.log_test(test_name, False, "No auth token available")
            return False
        
        add_movie_data = {
            "tmdb_id": movie_data["tmdb_id"],
            "title": movie_data["title"],
            "poster_path": movie_data.get("poster_path"),
            "tmdb_rating": movie_data.get("tmdb_rating"),
            "genres": movie_data.get("genres", []),
            "year": movie_data.get("year"),
            "media_type": movie_data["media_type"]
        }
        
        response, success = self.make_request("POST", "/movies", add_movie_data)
        
        if not success:
            self.log_test(test_name, False, f"Request failed: {response}")
            return False
        
        if response.status_code == 200 or response.status_code == 201:
            try:
                data = response.json()
                if "id" in data:
                    self.created_movie_id = data["id"]
                    self.log_test(test_name, True, f"Movie '{movie_data['title']}' added successfully")
                    return True
                else:
                    self.log_test(test_name, False, "Missing movie ID in response", data)
                    return False
            except Exception as e:
                self.log_test(test_name, False, f"Invalid JSON response: {e}", response.text)
                return False
        elif response.status_code == 400:
            self.log_test(test_name, True, "Movie already exists (expected for repeated tests)")
            # Try to get the existing movie
            return self.test_get_movies()
        else:
            self.log_test(test_name, False, f"Add movie failed with status: {response.status_code}", response.text)
            return False
    
    def test_get_movies(self) -> bool:
        """Test getting all movies for user"""
        test_name = "Get All Movies"
        
        if not self.auth_token:
            self.log_test(test_name, False, "No auth token available")
            return False
        
        response, success = self.make_request("GET", "/movies")
        
        if not success:
            self.log_test(test_name, False, f"Request failed: {response}")
            return False
        
        if response.status_code == 200:
            try:
                movies = response.json()
                if isinstance(movies, list):
                    if len(movies) > 0 and not self.created_movie_id:
                        # Set the first movie ID for further testing
                        self.created_movie_id = movies[0].get("id")
                    self.log_test(test_name, True, f"Retrieved {len(movies)} movies from watchlist")
                    return True
                else:
                    self.log_test(test_name, False, "Response is not a list", movies)
                    return False
            except Exception as e:
                self.log_test(test_name, False, f"Invalid JSON response: {e}", response.text)
                return False
        else:
            self.log_test(test_name, False, f"Get movies failed with status: {response.status_code}", response.text)
            return False
    
    def test_update_movie(self) -> bool:
        """Test updating a movie (mark as watched with rating)"""
        test_name = "Update Movie (Mark as Watched)"
        
        if not self.auth_token:
            self.log_test(test_name, False, "No auth token available")
            return False
        
        if not self.created_movie_id:
            self.log_test(test_name, False, "No movie ID available for testing")
            return False
        
        update_data = {
            "watched": True,
            "personal_rating": 8
        }
        
        response, success = self.make_request("PUT", f"/movies/{self.created_movie_id}", update_data)
        
        if not success:
            self.log_test(test_name, False, f"Request failed: {response}")
            return False
        
        if response.status_code == 200:
            try:
                data = response.json()
                if data.get("watched") == True and data.get("personal_rating") == 8:
                    self.log_test(test_name, True, "Movie marked as watched with rating 8")
                    return True
                else:
                    self.log_test(test_name, False, "Movie not updated correctly", data)
                    return False
            except Exception as e:
                self.log_test(test_name, False, f"Invalid JSON response: {e}", response.text)
                return False
        else:
            self.log_test(test_name, False, f"Update movie failed with status: {response.status_code}", response.text)
            return False
    
    def test_delete_movie(self) -> bool:
        """Test deleting a movie"""
        test_name = "Delete Movie"
        
        if not self.auth_token:
            self.log_test(test_name, False, "No auth token available")
            return False
        
        if not self.created_movie_id:
            self.log_test(test_name, False, "No movie ID available for testing")
            return False
        
        response, success = self.make_request("DELETE", f"/movies/{self.created_movie_id}")
        
        if not success:
            self.log_test(test_name, False, f"Request failed: {response}")
            return False
        
        if response.status_code == 200:
            try:
                data = response.json()
                if "message" in data:
                    self.log_test(test_name, True, "Movie deleted successfully")
                    return True
                else:
                    self.log_test(test_name, False, "Unexpected response format", data)
                    return False
            except Exception as e:
                self.log_test(test_name, False, f"Invalid JSON response: {e}", response.text)
                return False
        else:
            self.log_test(test_name, False, f"Delete movie failed with status: {response.status_code}", response.text)
            return False
    
    def test_error_cases(self) -> bool:
        """Test various error cases"""
        test_name = "Error Cases"
        error_tests_passed = 0
        total_error_tests = 3
        
        # Test 1: Invalid authentication
        old_token = self.auth_token
        self.auth_token = "invalid_token"
        response, success = self.make_request("GET", "/movies")
        if success and response.status_code == 401:
            error_tests_passed += 1
            print("   ✅ Invalid auth token properly rejected")
        else:
            print("   ❌ Invalid auth token not properly handled")
        
        # Restore valid token
        self.auth_token = old_token
        
        # Test 2: Duplicate movie (if we have a movie)
        if self.created_movie_id:
            # First, get a movie to try to duplicate
            response, success = self.make_request("GET", "/movies")
            if success and response.status_code == 200:
                movies = response.json()
                if len(movies) > 0:
                    movie = movies[0]
                    duplicate_data = {
                        "tmdb_id": movie["tmdb_id"],
                        "title": movie["title"],
                        "media_type": movie["media_type"]
                    }
                    response, success = self.make_request("POST", "/movies", duplicate_data)
                    if success and response.status_code == 400:
                        error_tests_passed += 1
                        print("   ✅ Duplicate movie properly rejected")
                    else:
                        print("   ❌ Duplicate movie not properly handled")
                else:
                    error_tests_passed += 1  # No movies to test duplicate with
                    print("   ✅ No movies to test duplicate (acceptable)")
            else:
                print("   ❌ Could not retrieve movies for duplicate test")
        else:
            error_tests_passed += 1  # No movie ID to test with
            print("   ✅ No movie ID to test duplicate (acceptable)")
        
        # Test 3: Invalid movie ID for update/delete
        response, success = self.make_request("PUT", "/movies/invalid_id", {"watched": True})
        if success and response.status_code == 404:
            error_tests_passed += 1
            print("   ✅ Invalid movie ID properly rejected")
        else:
            print("   ❌ Invalid movie ID not properly handled")
        
        success_rate = error_tests_passed / total_error_tests
        if success_rate >= 0.67:  # At least 2 out of 3 error tests should pass
            self.log_test(test_name, True, f"Error handling working ({error_tests_passed}/{total_error_tests} tests passed)")
            return True
        else:
            self.log_test(test_name, False, f"Error handling issues ({error_tests_passed}/{total_error_tests} tests passed)")
            return False
    
    def run_all_tests(self):
        """Run the complete test suite"""
        print("🚀 Starting Cineviax Backend Tests")
        print(f"Backend URL: {self.base_url}")
        print("=" * 60)
        
        # Test sequence as specified in the review request
        tests_passed = 0
        total_tests = 0
        
        # 1. Signup a new user
        total_tests += 1
        if self.test_signup():
            tests_passed += 1
        
        # 2. Login with the user (if signup failed)
        if not self.auth_token:
            total_tests += 1
            if self.test_login():
                tests_passed += 1
        
        # 3. Search TMDB for "inception"
        total_tests += 1
        movie_data = self.test_tmdb_search()
        if movie_data:
            tests_passed += 1
        
        # 4. Add a movie from TMDB results to watchlist
        if movie_data:
            total_tests += 1
            if self.test_add_movie(movie_data):
                tests_passed += 1
        
        # 5. Get all movies and verify it's added
        total_tests += 1
        if self.test_get_movies():
            tests_passed += 1
        
        # 6. Mark the movie as watched with a personal rating
        total_tests += 1
        if self.test_update_movie():
            tests_passed += 1
        
        # 7. Test deleting the movie
        total_tests += 1
        if self.test_delete_movie():
            tests_passed += 1
        
        # 8. Test error cases
        total_tests += 1
        if self.test_error_cases():
            tests_passed += 1
        
        # Print summary
        print("=" * 60)
        print(f"🏁 Test Summary: {tests_passed}/{total_tests} tests passed")
        
        if tests_passed == total_tests:
            print("🎉 All tests passed! Backend is working correctly.")
            return True
        else:
            print(f"⚠️  {total_tests - tests_passed} test(s) failed. Check details above.")
            return False
    
    def get_failed_tests(self):
        """Return list of failed tests"""
        return [test for test in self.test_results if not test["success"]]

if __name__ == "__main__":
    tester = CineviaxTester()
    success = tester.run_all_tests()
    
    # Print detailed results for failed tests
    failed_tests = tester.get_failed_tests()
    if failed_tests:
        print("\n" + "=" * 60)
        print("❌ FAILED TESTS DETAILS:")
        for test in failed_tests:
            print(f"\nTest: {test['test']}")
            print(f"Message: {test['message']}")
            if test['details']:
                print(f"Details: {test['details']}")
    
    exit(0 if success else 1)