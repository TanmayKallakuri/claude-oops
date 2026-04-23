import { z } from "zod";

export const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(24, "Username must be at most 24 characters")
  .regex(
    /^[a-z0-9_]+$/,
    "Username may only contain lowercase letters, digits, and underscores",
  );

export const signupSchema = z.object({
  email: z.email(),
  password: z.string().min(10, "Password must be at least 10 characters"),
  username: usernameSchema,
});

export const signinSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type SigninInput = z.infer<typeof signinSchema>;
