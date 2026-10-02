"use client";

import { useState } from "react";

export default function PasswordField({
  name,
  label,
  autoComplete,
  minLength,
  required=true,
}:{
  name:string;
  label:string;
  autoComplete:string;
  minLength?:number;
  required?:boolean;
}){
  const [visible,setVisible]=useState(false);
  return (
    <label className="auth-password-field">
      <span>{label}</span>
      <span className="auth-password-control">
        <input
          name={name}
          type={visible ? "text" : "password"}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="auth-password-toggle"
          onClick={()=>setVisible(value=>!value)}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </span>
    </label>
  );
}
