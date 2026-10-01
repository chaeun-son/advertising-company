import { create } from "zustand";

const KEY = "adsmile-staff";

type StaffSession = {
  name: string;
  hydrated: boolean;
  setName: (name: string) => void;
  hydrate: () => void;
};

export const useStaffSession = create<StaffSession>((set) => ({
  name: "",
  hydrated: false,
  setName: (name) => {
    if (typeof window !== "undefined") localStorage.setItem(KEY, name);
    set({ name, hydrated: true });
  },
  hydrate: () => {
    if (typeof window === "undefined") return;
    set({ name: localStorage.getItem(KEY) ?? "", hydrated: true });
  },
}));
