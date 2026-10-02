import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { BRAND, PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, authEnabled } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listStaffLogins, registerStaff, resetStaffPassword } from "@/lib/server/api";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<"in" | "up" | "reset">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<{ name: string; email: string }[] | null>(null);

  if (isPending) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <p className="text-sm text-muted">확인 중…</p>
      </div>
    );
  }
  if (user) return <Navigate to="/" />;

  function switchMode(next: "in" | "up" | "reset") {
    setMode(next);
    setError(null);
    setInfo(null);
    setAccounts(null);
    setConfirm("");
  }

  async function enter() {
    const { error: err } = await authClient.signIn.email({
      email: email.trim(),
      password,
      callbackURL: "/",
    });
    if (err) {
      throw new Error(
        err.message?.includes("Invalid") || err.message?.includes("password")
          ? "이메일 또는 비밀번호가 맞지 않습니다. 비번 새로 만들기로 다시 정해 주세요."
          : (err.message ?? "로그인에 실패했습니다."),
      );
    }
    await authClient.getSession();
    window.location.assign("/");
  }

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (mode !== "in" && password !== confirm) {
      setError("새 비밀번호와 확인이 같지 않습니다.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "up") {
        await registerStaff({
          data: {
            name: name.trim(),
            email: email.trim(),
            password,
            inviteCode: inviteCode.trim(),
          },
        });
        setInfo("계정을 만들었습니다. 들어가는 중…");
      } else if (mode === "reset") {
        const res = await resetStaffPassword({
          data: {
            name: name.trim(),
            email: email.trim(),
            password,
            inviteCode: inviteCode.trim(),
          },
        });
        setInfo(res.created ? "계정을 만들고 비밀번호를 저장했습니다. 들어가는 중…" : "새 비밀번호를 저장했습니다. 들어가는 중…");
      }
      await enter();
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다.");
      setBusy(false);
    }
  }

  async function revealAccounts() {
    setError(null);
    setBusy(true);
    try {
      const rows = await listStaffLogins({ data: { inviteCode: inviteCode.trim() } });
      setAccounts(rows);
      if (rows.length === 0) setInfo("아직 만든 계정이 없습니다. 이름을 넣고 아래에서 새로 만들면 됩니다.");
    } catch (err) {
      setAccounts(null);
      setError(err instanceof Error ? err.message : "확인할 수 없습니다.");
    } finally {
      setBusy(false);
    }
  }

  const heading =
    mode === "up" ? "직원 계정 만들기" : mode === "reset" ? "비번 새로 만들기" : "들어가기";

  return (
    <main className="relative min-h-dvh bg-bg">
      <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-1.5 bg-primary md:block" />
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
        <img src={BRAND.lockup} alt={`${PRODUCT_NAME} · ${PRODUCT_TAGLINE}`} className="h-auto w-full max-w-[16rem] object-contain" />

        <h1 className="mt-8 font-display text-3xl font-semibold tracking-tight">{heading}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {mode === "reset"
            ? "초대코드와 이메일을 넣고 새 비밀번호를 두 번 적습니다. 이메일이 기억나지 않으면 가입한 이메일 보기를 누르세요. 계정이 없으면 이름까지 적으면 새로 만들어 들어갑니다."
            : mode === "up"
              ? "설정에 있는 직원 이름과 같게 적습니다. 초대코드는 아직 안 바꿨으면 adsmile 입니다."
              : "직원만 들어옵니다. 비밀번호를 잊었으면 아래 비번 새로 만들기를 누르세요."}
        </p>

        {!authEnabled ? (
          <p className="mt-8 text-sm text-muted">지금 로그인을 켤 수 없습니다.</p>
        ) : (
          <>
            <form className="mt-8 space-y-3" onSubmit={onEmail}>
              {mode !== "in" ? (
                <div>
                  <Label htmlFor="login-invite">초대코드</Label>
                  <Input
                    id="login-invite"
                    value={inviteCode}
                    onChange={(e) => {
                      setInviteCode(e.target.value);
                      setAccounts(null);
                    }}
                    placeholder="아직 안 바꿨으면 adsmile"
                    autoComplete="off"
                    required
                  />
                </div>
              ) : null}
              {mode === "reset" ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  disabled={busy || inviteCode.trim().length < 1}
                  onClick={() => void revealAccounts()}
                >
                  가입한 이메일 보기
                </Button>
              ) : null}
              {mode === "reset" && accounts && accounts.length > 0 ? (
                <ul className="space-y-1 rounded-[var(--radius-sm)] bg-elevated p-3 text-sm shadow-[var(--shadow-border)]">
                  {accounts.map((a) => (
                    <li key={a.email}>
                      <button
                        type="button"
                        className="text-left text-accent hover:underline"
                        onClick={() => {
                          setEmail(a.email);
                          setName(a.name);
                        }}
                      >
                        {a.name} · {a.email}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {mode !== "in" ? (
                <div>
                  <Label htmlFor="login-name">이름 {mode === "reset" ? "(계정이 없을 때만)" : "(직원 명단과 같게)"}</Label>
                  <Input
                    id="login-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="손채은"
                    autoComplete="name"
                    required={mode === "up"}
                  />
                </div>
              ) : null}
              <div>
                <Label htmlFor="login-email">이메일</Label>
                <Input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="직원 이메일"
                  autoComplete="email"
                />
              </div>
              <div>
                <Label htmlFor="login-password">{mode === "in" ? "비밀번호" : "새 비밀번호"}</Label>
                <Input
                  id="login-password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8자 이상"
                  autoComplete={mode === "in" ? "current-password" : "new-password"}
                />
              </div>
              {mode !== "in" ? (
                <div>
                  <Label htmlFor="login-confirm">새 비밀번호 확인</Label>
                  <Input
                    id="login-confirm"
                    type="password"
                    required
                    minLength={8}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="한 번 더"
                    autoComplete="new-password"
                  />
                </div>
              ) : null}
              {info ? <p className="text-sm text-accent">{info}</p> : null}
              {error ? <p className="text-sm text-stamp">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy
                  ? "잠시만요…"
                  : mode === "up"
                    ? "계정 만들고 들어가기"
                    : mode === "reset"
                      ? "새 비밀번호로 들어가기"
                      : "들어가기"}
              </Button>
            </form>

            {mode === "in" ? (
              <Button
                type="button"
                variant="secondary"
                className="mt-3 w-full"
                onClick={() => switchMode("reset")}
              >
                비번 새로 만들기
              </Button>
            ) : null}

            <div className="mt-3 flex flex-col gap-1.5 text-sm text-muted">
              {mode !== "in" ? (
                <button
                  type="button"
                  className="text-left underline-offset-4 hover:text-fg hover:underline"
                  onClick={() => switchMode("in")}
                >
                  이미 계정이 있으면 로그인
                </button>
              ) : null}
              {mode !== "up" ? (
                <button
                  type="button"
                  className="text-left underline-offset-4 hover:text-fg hover:underline"
                  onClick={() => switchMode("up")}
                >
                  처음이면 계정 만들기
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
