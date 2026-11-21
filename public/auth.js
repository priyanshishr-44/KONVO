// ======================================
// LOGIN
// ======================================

const loginForm = document.getElementById("loginForm");

if (loginForm) {

    loginForm.addEventListener("submit", async (e) => {

        e.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        const message = document.getElementById("message");
        const button = document.getElementById("loginBtn");

        button.disabled = true;
        button.textContent = "Logging in...";

        try {

            const response = await fetch("/api/auth/login", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                credentials: "include",

                body: JSON.stringify({
                    email,
                    password
                })

            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Login failed.");
            }

            message.style.color = "#36d399";
            message.textContent = "Login successful! Redirecting...";

            window.location.href = "/dashboard";

        } catch (error) {

            message.style.color = "#ff8585";
            message.textContent = error.message;

        } finally {

            button.disabled = false;
            button.textContent = "Login to KONVO";

        }

    });

}


// ======================================
// SIGNUP
// ======================================

const signupForm = document.getElementById("signupForm");

if (signupForm) {

    signupForm.addEventListener("submit", async (e) => {

        e.preventDefault();

        const name = document.getElementById("name").value.trim();
        const username = document.getElementById("username").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        const message = document.getElementById("message");
        const button = document.getElementById("signupBtn");

        button.disabled = true;
        button.textContent = "Creating Account...";

        try {

            const response = await fetch("/api/auth/signup", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                credentials: "include",

                body: JSON.stringify({
                    name,
                    username,
                    email,
                    password
                })

            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Signup failed.");
            }

            message.style.color = "#36d399";
            message.textContent = "Account created! Please login.";

            signupForm.reset();

            setTimeout(() => {
                window.location.href = "/login";
            }, 1500);

        } catch (error) {

            message.style.color = "#ff8585";
            message.textContent = error.message;

        } finally {

            button.disabled = false;
            button.textContent = "Create My Account";

        }

    });

}