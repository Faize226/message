"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

export default function LoginForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const username = form.get("username") as string;
    const password = form.get("password") as string;

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Nom d'utilisateur ou mot de passe incorrect");
    } else {
      router.push("/chat");
      router.refresh();
    }
  }

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-[#07070a] overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[#3b82f6]/15 blur-[120px]" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-[#8b5cf6]/15 blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#3b82f6]/5 blur-[150px]" />
      </div>

      <div
        className={`w-full max-w-sm px-4 transition-all duration-700 ease-out ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        }`}
      >
        <Card className="border border-white/[0.06] bg-white/[0.03] backdrop-blur-2xl shadow-2xl">
          <CardHeader className="flex flex-col items-center space-y-1.5 pb-6 pt-10">
            <div className="space-y-2 flex flex-col items-center">
              <h2 className="text-2xl font-semibold tracking-tight text-white/90">
                Connexion
              </h2>
              <p className="text-white/40 text-sm">
                Connecte-toi pour discuter
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 px-8 pb-10">
            {error && (
              <div className="flex items-center gap-2.5 rounded-xl bg-red-500/10 border border-red-500/15 px-4 py-3 text-sm text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-sm text-white/60 font-normal">
                  Identifiant
                </Label>
                <Input
                  ref={inputRef}
                  id="username"
                  name="username"
                  placeholder="Nom d'utilisateur"
                  required
                  disabled={loading}
                  className="h-10 bg-white/[0.04] border-white/[0.08] text-white/80 placeholder:text-white/20 rounded-xl transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40 focus-visible:border-[#3b82f6]/40 focus-visible:bg-white/[0.06]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm text-white/60 font-normal">
                  Mot de passe
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    required
                    disabled={loading}
                    className="h-10 bg-white/[0.04] border-white/[0.08] text-white/80 placeholder:text-white/20 rounded-xl pr-10 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40 focus-visible:border-[#3b82f6]/40 focus-visible:bg-white/[0.06]"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    tabIndex={-1}
                    disabled={loading}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-white/30 hover:text-white/60 hover:bg-white/[0.06] rounded-lg"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-10 rounded-xl bg-white text-[#07070a] font-medium hover:bg-white/90 transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Connexion...
                  </>
                ) : (
                  "Se connecter"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
