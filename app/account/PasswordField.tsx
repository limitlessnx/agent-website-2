"use client";

import { useId, useState } from "react";

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
  const labelId=useId();
  return (
    <label className="auth-password-field">
      <span id={labelId}>{label}</span>
      <span className="auth-password-control">
        <input
          name={name}
          aria-labelledby={labelId}
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
