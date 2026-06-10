import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./_components/login-form";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <Image
        src="/campus.jpg"
        alt="School of Field Artillery campus"
        fill
        priority
        className="object-cover"
      />
      <div className="absolute inset-0 bg-black/40" />
      <Card className="relative z-10 w-full max-w-sm border-white/20 bg-card/95 shadow-2xl backdrop-blur-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex items-center justify-center">
            <Image
              src="/school-of-artillery.png"
              alt="School of Artillery crest"
              width={72}
              height={56}
              className="h-14 w-auto"
              priority
            />
          </div>
          <CardTitle className="text-xl">School of Field Artillery</CardTitle>
          <p className="text-sm text-muted-foreground">
            Sign in to access the management system
          </p>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
