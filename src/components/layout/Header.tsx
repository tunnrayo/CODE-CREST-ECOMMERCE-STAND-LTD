import Link from "next/link";
import { Heart, Search, User } from "lucide-react";
import { Logo } from "../brand/Logo";
import { CartButton } from "../cart/CartUI";
import { MobileMenu } from "./MobileMenu";
import { NavLinks } from "./NavLinks";

type Cat = { slug: string; name: string };

export function SearchForm({ defaultValue = "", id = "site-search" }: { defaultValue?: string; id?: string }) {
  return (
    <form action="/search" method="get" role="search" className="relative w-full">
      <label htmlFor={id} className="sr-only">
        Search products
      </label>
      <input
        id={id}
        name="q"
        defaultValue={defaultValue}
        placeholder="Search products, e.g. power bank, kettle, backpack"
        className="h-11 w-full rounded-full border-0 bg-white pl-4 pr-12 text-sm text-grey-900 placeholder:text-grey-400 focus:outline-none focus:ring-2 focus:ring-lime"
        autoComplete="off"
        maxLength={100}
      />
      <button type="submit" className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-full bg-lime text-burgundy-800 hover:bg-lime-300" aria-label="Search">
        <Search className="h-4 w-4" />
      </button>
    </form>
  );
}

export function Header({ categories, announcement, userName, logoUrl }: { categories: Cat[]; announcement: string; userName: string | null; logoUrl: string | null }) {
  return (
    <header className="sticky top-0 z-40">
      {announcement && (
        <div className="bg-lime text-burgundy-800">
          <p className="container-x py-1.5 text-center text-xs font-medium sm:text-[13px]">{announcement}</p>
        </div>
      )}
      <div className="bg-burgundy text-white shadow-md">
        <div className="container-x flex h-[68px] items-center gap-3 sm:gap-6">
          <MobileMenu categories={categories} userName={userName} />
          <Link href="/" className="shrink-0" aria-label="Code Crest home">
            <Logo onDark logoUrl={logoUrl} />
          </Link>
          <div className="hidden flex-1 md:block">
            <SearchForm />
          </div>
          <nav className="ml-auto flex items-center gap-1" aria-label="Account">
            <Link href={userName ? "/account" : "/account/login"} className="hidden h-11 items-center gap-2 rounded-full px-3 text-sm font-medium hover:bg-white/10 sm:inline-flex" data-testid="account-link">
              <User className="h-5 w-5" aria-hidden />
              <span className="max-w-[120px] truncate">{userName ? `Hi, ${userName.split(" ")[0]}` : "Sign in"}</span>
            </Link>
            <Link href="/wishlist" className="hidden h-11 w-11 items-center justify-center rounded-full hover:bg-white/10 sm:inline-flex" aria-label="Wishlist">
              <Heart className="h-5 w-5" />
            </Link>
            <CartButton />
          </nav>
        </div>
        <div className="container-x pb-3 md:hidden">
          <SearchForm id="site-search-mobile" />
        </div>
        <div className="hidden border-t border-white/10 md:block">
          <NavLinks categories={categories} />
        </div>
      </div>
    </header>
  );
}
