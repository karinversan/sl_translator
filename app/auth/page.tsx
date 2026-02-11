"use client";

import Link from "next/link";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AuthPage() {
  return (
    <section className="container flex min-h-[calc(100dvh-12rem)] items-center justify-center py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative w-full max-w-md"
      >
        <div className="absolute -left-12 top-8 h-40 w-40 rounded-full bg-cyan-500/20 blur-[90px]" />
        <div className="absolute -right-16 bottom-4 h-44 w-44 rounded-full bg-fuchsia-500/20 blur-[100px]" />

        <Card className="relative">
          <CardHeader>
            <CardTitle>Sign in / Sign up</CardTitle>
            <CardDescription>Минималистичная форма в стеклянной карточке.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" placeholder="you@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" placeholder="••••••••" />
            </div>
            <Button className="w-full">Continue</Button>
            <Button className="w-full" variant="secondary">
              Continue with Google
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              By continuing you agree with the demo terms. <Link href="/docs">Learn more</Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </section>
  );
}
