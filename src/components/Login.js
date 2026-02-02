// src/components/Login.js
import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import "./Login.css";

const Login = () => {
  const [formData, setFormData] = useState({
    identifier: "", // Can be email, phone, or username
    password: "",
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Detect what type of identifier the user entered
  const detectIdentifierType = (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^(?:\+233|0)([235789]\d{8})$/;

    if (emailRegex.test(value)) return "email";
    if (phoneRegex.test(value)) return "phone";
    return "username";
  };

  // Normalize phone number
  const normalizePhone = (value) => {
    if (!value) return value;
    let cleaned = value.replace(/\s+/g, "");
    if (cleaned.startsWith("0") && cleaned.length === 10) {
      return "+233" + cleaned.slice(1);
    }
    return cleaned;
  };

  // Find user by phone or username
  const findUserEmail = async (identifier, type) => {
    try {
      let q;
      if (type === "phone") {
        const normalized = normalizePhone(identifier);
        q = query(collection(db, "users"), where("phone", "==", normalized));
      } else if (type === "username") {
        // Search by name or displayName (case-insensitive)
        const lowerIdentifier = identifier.toLowerCase();
        q = query(collection(db, "users"), where("email", ">=", ""));
        const snapshot = await getDocs(q);
        
        for (const doc of snapshot.docs) {
          const userData = doc.data();
          const name = (userData.name || "").toLowerCase();
          const displayName = (userData.displayName || "").toLowerCase();
          
          if (name === lowerIdentifier || displayName === lowerIdentifier) {
            return userData.email;
          }
        }
        return null;
      }

      if (type === "phone") {
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          return snapshot.docs[0].data().email;
        }
      }
      
      return null;
    } catch (error) {
      console.error("Error finding user:", error);
      return null;
    }
  };

  const validate = (field, value) => {
    let err = "";

    switch (field) {
      case "identifier":
        if (!value.trim()) {
          err = "Email, phone, or username is required";
        }
        break;
      case "password":
        if (!value) {
          err = "Password is required";
        }
        break;
      default:
        break;
    }

    return err;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setTouched((prev) => ({ ...prev, [name]: true }));

    // Clear errors on change
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
    if (errors.submit) {
      setErrors((prev) => ({ ...prev, submit: "" }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    const err = validate(name, value);
    setErrors((prev) => ({ ...prev, [name]: err }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = {};
    Object.keys(formData).forEach((key) => {
      const err = validate(key, formData[key]);
      if (err) newErrors[key] = err;
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setTouched(Object.fromEntries(Object.keys(formData).map((k) => [k, true])));
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const identifierType = detectIdentifierType(formData.identifier.trim());
      let emailToUse = formData.identifier.trim();

      // If not email, find the associated email
      if (identifierType !== "email") {
        const foundEmail = await findUserEmail(formData.identifier.trim(), identifierType);
        if (!foundEmail) {
          setErrors({ 
            submit: identifierType === "phone" 
              ? "No account found with this phone number." 
              : "No account found with this username." 
          });
          return;
        }
        emailToUse = foundEmail;
      }

      // Sign in with email and password
      await signInWithEmailAndPassword(auth, emailToUse, formData.password);

      // Redirect after successful login
      window.location.href = "/"; // or use navigate("/")
    } catch (error) {
      let msg = "Login failed. Please try again.";
      
      switch (error.code) {
        case "auth/user-not-found":
          msg = "No account found with this information.";
          break;
        case "auth/wrong-password":
        case "auth/invalid-credential":
          msg = "Incorrect password. Please try again.";
          break;
        case "auth/invalid-email":
          msg = "Invalid email format.";
          break;
        case "auth/user-disabled":
          msg = "This account has been disabled.";
          break;
        case "auth/too-many-requests":
          msg = "Too many failed attempts. Please wait and try again.";
          break;
        case "auth/network-request-failed":
          msg = "Network error. Check your connection.";
          break;
        default:
          console.error("Login error:", error);
      }
      
      setErrors({ submit: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const isFormValid = () =>
    formData.identifier.trim() &&
    formData.password &&
    !Object.values(errors).some(Boolean);

  return (
    <div className="pulse-page">
      <div className="pulse-card">
        <div className="pulse-brand">
          <div className="pulse-logo">
            <i className="bi bi-activity"></i>
          </div>
          <h1>Pulse</h1>
        </div>

        <h2>Welcome back</h2>
        <p className="pulse-tagline">Sign in to continue your journey</p>

        {errors.submit && (
          <div className="error-banner">{errors.submit}</div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="identifier">Email, Phone, or Username</label>
            <div className="input-group">
              <i className="bi bi-person-circle input-icon"></i>
              <input
                id="identifier"
                name="identifier"
                type="text"
                placeholder="Enter your email, phone, or username"
                value={formData.identifier}
                onChange={handleChange}
                onBlur={handleBlur}
                className={touched.identifier && errors.identifier ? "invalid" : ""}
                aria-invalid={!!(touched.identifier && errors.identifier)}
                autoComplete="username"
                required
              />
            </div>
            {touched.identifier && errors.identifier && (
              <span className="field-error">{errors.identifier}</span>
            )}
            <div className="input-hint">
              <i className="bi bi-info-circle"></i>
              <span>You can log in with your email, phone number, or username</span>
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="password">Password</label>
            <div className="input-group">
              <i className="bi bi-lock input-icon"></i>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                onBlur={handleBlur}
                className={touched.password && errors.password ? "invalid" : ""}
                aria-invalid={!!(touched.password && errors.password)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="toggle-password"
                onClick={togglePasswordVisibility}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`}></i>
              </button>
            </div>
            {touched.password && errors.password && (
              <span className="field-error">{errors.password}</span>
            )}
          </div>

          <div className="form-extras">
            <label className="remember-me">
              <input type="checkbox" />
              <span>Remember me</span>
            </label>
            <a href="/forgot-password" className="forgot-link">
              Forgot password?
            </a>
          </div>

          <button
            type="submit"
            className="pulse-btn"
            disabled={isSubmitting || !isFormValid()}
          >
            {isSubmitting ? (
              <>
                <span className="loading-dot"></span> Signing in...
              </>
            ) : (
              <>
                <i className="bi bi-box-arrow-in-right"></i> Sign In
              </>
            )}
          </button>

          <div className="divider">
            <span>or</span>
          </div>

          <p className="signup-link">
            New to Pulse? <a href="/signup">Create an account</a>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Login;