import React from "react";

interface AuthLayoutProps {
  aside?: React.ReactNode;
  children: React.ReactNode;
}

export default function AuthLayout({ aside, children }: AuthLayoutProps) {
  return (
    <section className="container mx-auto px-4 py-8">
      <div className="grid gap-8 md:grid-cols-2 items-stretch">
        {aside ? (
          <aside className="hidden md:flex">
            {/* Wrapper to ensure full height and consistent spacing */}
            <div className="flex flex-1 rounded-2xl overflow-hidden shadow-elegant">
              {aside}
            </div>
          </aside>
        ) : null}

        <article className="flex items-center">{children}</article>
      </div>
    </section>
  );
}
