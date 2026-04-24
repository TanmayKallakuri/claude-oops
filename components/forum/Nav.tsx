"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { WordMark } from "@/components/brand/WordMark";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Dropdown, DropdownItem } from "@/components/ui/Dropdown";

type Me = { id: string; username: string; display_name: string | null } | null;

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (r) => {
        if (!r.ok) return setMe(null);
        const body = (await r.json()) as { profile: Me };
        setMe(body.profile);
      })
      .finally(() => setLoaded(true));
  }, [pathname]);

  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    setMe(null);
    router.push("/" as never);
    router.refresh();
  }

  const transparent = pathname === "/";

  return (
    <nav
      className={
        (transparent ? "absolute" : "sticky bg-oops-bg/85 backdrop-blur border-b border-oops-border") +
        " top-0 left-0 right-0 z-30 h-14 flex items-center px-4 md:px-8"
      }
    >
      <div className="flex-1 flex items-center gap-4">
        <Link href={"/" as never} className="flex items-center">
          <WordMark size="md" />
        </Link>
      </div>
      <div className="flex items-center gap-3">
        {!loaded ? null : me ? (
          <>
            <Link href={"/new" as never}>
              <Button size="sm" variant="primary">
                New thread
              </Button>
            </Link>
            <Dropdown
              trigger={<Avatar username={me.username} displayName={me.display_name} size="md" />}
              align="right"
            >
              <div className="px-4 py-2 text-xs text-oops-muted border-b border-oops-border">
                @{me.username}
              </div>
              <DropdownItem onClick={() => router.push(`/u/${me.username}` as never)}>
                View profile
              </DropdownItem>
              <DropdownItem onClick={() => router.push("/settings" as never)}>
                Settings
              </DropdownItem>
              <div className="border-t border-oops-border" />
              <DropdownItem variant="danger" onClick={signOut}>
                Sign out
              </DropdownItem>
            </Dropdown>
          </>
        ) : (
          <>
            <Link href={"/signin" as never} className="text-sm text-oops-muted hover:text-oops-text font-medium">
              Sign in
            </Link>
            <Link href={"/signup" as never}>
              <Button size="sm" variant="primary">
                Sign up
              </Button>
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
