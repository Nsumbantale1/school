import { AuthCard } from "./_components/auth-card";
import { ForgotPasswordForm } from "./_components/forgot-form";

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Forgot password"
      subtitle="Enter your username. You will get a reset link by email, or the administrator will set a new password for you."
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
