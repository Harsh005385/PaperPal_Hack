"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Menu,
  X,
  ArrowRight,
  Sparkles,
  LogOut,
  User,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function Navbar() {
  const router = useRouter();
  const { user, isLoggedIn, logout, loading } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "/formats", label: "Formats" },
    { href: "/upload", label: "Convert" },
    { href: "/editor", label: "Editor" },
    { href: "/pro/upload", label: "Pro", isPro: true },
  ];

  const handleLogout = async () => {
    await logout();
    setShowUserMenu(false);
    router.push("/");
  };

  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : "";

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 30 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? "glass border-b border-ink-100/50 shadow-sm"
            : "bg-transparent"
        }`}
      >
        <nav className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-ink-900 text-white transition-transform duration-300 group-hover:scale-110">
                <FileText className="h-4.5 w-4.5" />
                <div className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-accent border-2 border-paper-50" />
              </div>
              <span className="font-display text-xl tracking-tight text-ink-900">
                PaperPal
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-4 py-2 text-sm font-medium transition-colors group ${
                    "isPro" in link && link.isPro
                      ? "text-amber-600 hover:text-amber-700"
                      : "text-ink-500 hover:text-ink-800"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {link.label}
                    {"isPro" in link && link.isPro && (
                      <span className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-1.5 py-px text-[8px] font-bold text-white uppercase leading-none">
                        new
                      </span>
                    )}
                  </span>
                  <span className={`absolute bottom-0.5 left-4 right-4 h-px scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left ${
                    "isPro" in link && link.isPro ? "bg-amber-500" : "bg-accent"
                  }`} />
                </Link>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-3">
              {!loading && isLoggedIn && user ? (
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2.5 rounded-full border border-paper-200 bg-white/80 pl-1.5 pr-4 py-1.5 text-sm font-medium text-ink-700 hover:bg-white hover:border-paper-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-900 text-white text-xs font-bold">
                      {initials}
                    </div>
                    <span className="max-w-[120px] truncate">
                      {user.firstName}
                    </span>
                  </button>

                  <AnimatePresence>
                    {showUserMenu && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setShowUserMenu(false)}
                        />
                        <motion.div
                          initial={{ opacity: 0, y: -8, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -8, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-white border border-paper-200 shadow-xl z-50 overflow-hidden"
                        >
                          <div className="px-4 py-3 border-b border-paper-100">
                            <p className="text-sm font-medium text-ink-800 truncate">
                              {user.firstName} {user.lastName}
                            </p>
                            <p className="text-xs text-ink-400 truncate">
                              {user.email}
                            </p>
                          </div>
                          <div className="p-1.5">
                            <Link
                              href="/upload"
                              onClick={() => setShowUserMenu(false)}
                              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-ink-600 hover:bg-paper-50 hover:text-ink-800 transition-colors"
                            >
                              <Sparkles className="h-4 w-4" />
                              Convert Paper
                            </Link>
                            <button
                              onClick={handleLogout}
                              className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <LogOut className="h-4 w-4" />
                              Sign Out
                            </button>
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              ) : !loading ? (
                <>
                  <Link
                    href="/auth"
                    className="text-sm font-medium text-ink-500 hover:text-ink-800 transition-colors px-4 py-2"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/upload"
                    className="group flex items-center gap-2 rounded-full bg-ink-900 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-ink-800 hover:shadow-lg hover:shadow-ink-900/20 active:scale-[0.97]"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Start Converting
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </>
              ) : null}
            </div>

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden flex h-9 w-9 items-center justify-center rounded-lg hover:bg-ink-100 transition-colors"
            >
              {mobileOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </nav>
      </motion.header>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed inset-x-0 top-16 z-40 glass border-b border-ink-100/50 md:hidden"
          >
            <div className="px-6 py-4 space-y-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    "isPro" in link && link.isPro
                      ? "text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                      : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
                  }`}
                >
                  {link.label}
                  {"isPro" in link && link.isPro && (
                    <span className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-1.5 py-px text-[8px] font-bold text-white uppercase leading-none">
                      new
                    </span>
                  )}
                </Link>
              ))}
              <div className="pt-3 border-t border-ink-100 mt-3 space-y-2">
                {isLoggedIn && user ? (
                  <>
                    <div className="flex items-center gap-3 px-4 py-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-900 text-white text-xs font-bold">
                        {initials}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-ink-800">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-xs text-ink-400">{user.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        handleLogout();
                        setMobileOpen(false);
                      }}
                      className="w-full flex items-center justify-center gap-2 rounded-full border border-red-200 px-5 py-3 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/auth"
                      onClick={() => setMobileOpen(false)}
                      className="block px-4 py-3 rounded-xl text-sm font-medium text-ink-600 hover:bg-ink-50 hover:text-ink-900 transition-colors text-center"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/upload"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center justify-center gap-2 rounded-full bg-ink-900 px-5 py-3 text-sm font-medium text-white"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Start Converting
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
