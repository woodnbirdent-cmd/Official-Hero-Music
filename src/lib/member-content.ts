/**
 * Member-only posts. Add an object to the list for that section.
 * Updates: any signed-in member. Early access: Supporter and VIP. Downloads: VIP.
 */
export type MemberItem = {
  id: string;
  title: string;
  body: string;
  href?: string;
};

export const MEMBER_CONTENT: {
  updates: readonly MemberItem[];
  earlyAccess: readonly MemberItem[];
  downloads: readonly MemberItem[];
} = {
  updates: [
    {
      id: "welcome",
      title: "Welcome in",
      body: "This is the member updates feed. New notes from #Hero show up here.",
    },
    {
      id: "how-to-add",
      title: "Add an update",
      body: "Drop another item into updates in src/lib/member-content.ts and deploy.",
    },
  ],
  earlyAccess: [
    {
      id: "early-placeholder",
      title: "Early drops",
      body: "Supporter and VIP members will see new music here before it is public. Add items to earlyAccess in src/lib/member-content.ts.",
    },
  ],
  downloads: [],
};
