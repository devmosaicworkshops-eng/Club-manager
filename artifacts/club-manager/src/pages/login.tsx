import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/use-toast";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const loginMutation = useLogin();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  function onSubmit(values: z.infer<typeof loginSchema>) {
    loginMutation.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          login(data.token, data.user);
          if (data.user.role === "Admin") setLocation("/dashboard/admin");
          else if (data.user.role === "Coach") setLocation("/dashboard/coach");
          else setLocation("/dashboard/utilisateur");
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Invalid credentials. Please try again.",
            variant: "destructive",
          });
        },
      }
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full p-10 bg-white rounded-3xl shadow-[0_4px_20px_rgba(45,40,36,0.06)] border border-border">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-foreground rounded-xl mx-auto flex items-center justify-center mb-5">
            <span className="font-editorial text-background text-2xl italic">M</span>
          </div>
          <h1 className="font-editorial text-3xl text-foreground tracking-tight">
            Mosaic Workshops
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Connectez-vous pour gérer votre club
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom d'utilisateur</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Entrez votre nom d'utilisateur"
                      className="rounded-xl border-border bg-background/60 h-11"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mot de passe</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Entrez votre mot de passe"
                      className="rounded-xl border-border bg-background/60 h-11"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-full h-11 rounded-xl"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? "Connexion..." : "Se connecter"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
