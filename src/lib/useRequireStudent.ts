// src/lib/useRequireStudent.ts
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export interface StudentUser {
  id: string;
  name: string;
  matricNumber: string;
  department?: string;
  level?: number;
  loginDeviceId?: string;
  role?: string;
}

export default function useRequireStudent(): {
  user: StudentUser | null;
  loading: boolean;
} {
  const router = useRouter();
  const [user, setUser] = useState<StudentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem("unizik_user");
    if (!storedUser) {
      router.push("/login");
      return;
    }

    try {
      const parsed = JSON.parse(storedUser) as StudentUser;
      if (parsed.role === "ADMIN") {
        router.push("/admin/dashboard");
        return;
      }
      setUser(parsed);
    } catch {
      router.push("/login");
      return;
    } finally {
      setLoading(false);
    }
  }, [router]);

  return { user, loading };
}