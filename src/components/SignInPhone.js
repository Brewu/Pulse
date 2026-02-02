// src/components/SignInPhone.js
import React, { useState } from "react";
import { auth } from "../firebase";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import "../components/Login.css"; // reuse login styles

const SignInPhone = () => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmationResult, setConfirmationResult] = useState(null);

  const setupRecaptcha = () => {
    window.recaptchaVerifier = new RecaptchaVerifier(
      "recaptcha-container",
      {
        size: "invisible", // can also use "normal" for visible captcha
        callback: (response) => {
          console.log("Recaptcha verified!");
        }
      },
      auth
    );
  };

  const handleSendCode = async (e) => {
    e.preventDefault();
    setupRecaptcha();
    const appVerifier = window.recaptchaVerifier;

    try {
      const result = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      setConfirmationResult(result);
      alert("SMS code sent!");
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    try {
      if (!confirmationResult) return alert("Please request code first");

      const result = await confirmationResult.confirm(otp);
      const user = result.user;
      console.log("Phone login success:", user);

      alert("Phone login successful!");
    } catch (error) {
      console.error(error);
      alert("Invalid OTP, try again.");
    }
  };

  return (
    <div className="login-form">
      {!confirmationResult ? (
        <form onSubmit={handleSendCode}>
          <input
            placeholder="+233XXXXXXXXX"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            required
          />
          <div id="recaptcha-container"></div>
          <button type="submit">Send SMS Code</button>
        </form>
      ) : (
        <form onSubmit={handleVerifyCode}>
          <input
            placeholder="Enter OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            required
          />
          <button type="submit">Verify OTP</button>
        </form>
      )}
    </div>
  );
};

export default SignInPhone;