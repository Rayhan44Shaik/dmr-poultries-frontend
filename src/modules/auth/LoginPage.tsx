import { useNavigate } from "react-router-dom";
import { Building2 } from "lucide-react";

function LoginPage() {
  const navigate = useNavigate();

  const handleSignIn = () => {
    navigate("/dashboard");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f8fafc",
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          padding: "2.5rem",
          borderRadius: "1rem",
          boxShadow: "0 10px 40px rgba(0,0,0,0.08)",
          width: "100%",
          maxWidth: "400px",
          border: "1px solid #e2e8f0",
          textAlign: "center",
        }}
      >
        {/* Brand */}
        <div style={{ marginBottom: "2rem" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.75rem",
            }}
          >
            <div
              style={{
                height: "48px",
                width: "48px",
                borderRadius: "12px",
                backgroundColor: "#15803d",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
              }}
            >
              <Building2 size={28} />
            </div>
            <div style={{ textAlign: "left" }}>
              <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#15803d" }}>
                DMR Poultries
              </h1>
              <p style={{ fontSize: "0.75rem", color: "#64748b" }}>ERP System</p>
            </div>
          </div>
        </div>

        {/* Sign In Button */}
        <button
          onClick={handleSignIn}
          style={{
            width: "100%",
            padding: "0.75rem",
            backgroundColor: "#15803d",
            color: "white",
            fontWeight: "600",
            borderRadius: "0.5rem",
            border: "none",
            fontSize: "1rem",
            cursor: "pointer",
            transition: "background 0.2s",
            boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#166534")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#15803d")}
        >
          Sign In
        </button>

        <p
          style={{
            marginTop: "1.5rem",
            fontSize: "0.75rem",
            color: "#94a3b8",
          }}
        >
          © {new Date().getFullYear()} DMR Poultries. All rights reserved.
        </p>
      </div>
    </div>
  );
}

export default LoginPage;