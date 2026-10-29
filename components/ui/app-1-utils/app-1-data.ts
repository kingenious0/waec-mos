import { ChartConfig } from "@/components/ui/chart";

export const app1User = {
  name: "Dr. Mensah Osei",
  email: "m.osei@waec.org",
  avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=faces",
  initials: "MO",
};

export const app1ChartConfig = {
  opened: {
    label: "Tasks Opened",
    color: "#F6D300",
  },
  completed: {
    label: "Tasks Completed",
    color: "#2563EB",
  },
} satisfies ChartConfig;

export const app1Chart = [
  { week: "W1", opened: 45, completed: 32 },
  { week: "W2", opened: 52, completed: 48 },
  { week: "W3", opened: 38, completed: 41 },
  { week: "W4", opened: 65, completed: 59 },
  { week: "W5", opened: 48, completed: 53 },
  { week: "W6", opened: 70, completed: 68 },
  { week: "W7", opened: 55, completed: 62 },
  { week: "W8", opened: 42, completed: 58 },
];

export const app1Projects = [
  {
    id: "proj-1",
    name: "Ashanti WASSCE Security Audit",
    status: "In progress" as const,
    description: "Inspection and biometric verification checks across 48 Kumasi examination centers.",
    progress: 74,
    dueDate: "Nov 15",
    team: [
      {
        name: "Kofi Mensah",
        avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
        initials: "KM",
      },
      {
        name: "Akua Owusu",
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
        initials: "AO",
      },
      {
        name: "Emmanuel Boateng",
        avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop",
        initials: "EB",
      },
    ],
  },
  {
    id: "proj-2",
    name: "Question Paper Depots Geofencing",
    status: "In review" as const,
    description: "Configuring 150m GPS geofence alerts for regional script lockups.",
    progress: 92,
    dueDate: "Nov 08",
    team: [
      {
        name: "Samuel Quaye",
        avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&h=100&fit=crop",
        initials: "SQ",
      },
      {
        name: "Eunice Addo",
        avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop",
        initials: "EA",
      },
    ],
  },
  {
    id: "proj-3",
    name: "Supervisor Biometric Sync",
    status: "Planning" as const,
    description: "Pre-provisioning roster sync for incoming 2026 Nov/Dec exam invigilators.",
    progress: 35,
    dueDate: "Dec 01",
    team: [
      {
        name: "Dr. Mensah Osei",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
        initials: "MO",
      },
    ],
  },
];

export const app1Activity = [
  {
    id: "act-1",
    person: {
      name: "Kofi Mensah",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
      initials: "KM",
    },
    action: "verified check-in at Prempeh College Center A",
    time: "12 mins ago",
  },
  {
    id: "act-2",
    person: {
      name: "Akua Owusu",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
      initials: "AO",
    },
    action: "reported confidential seal unbroken at Yaa Asantewaa Center 2",
    time: "45 mins ago",
  },
  {
    id: "act-3",
    person: {
      name: "Emmanuel Boateng",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop",
      initials: "EB",
    },
    action: "resolved battery telemetry alert at Kumasi High School",
    time: "2 hours ago",
  },
  {
    id: "act-4",
    person: {
      name: "HQ Operations",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop",
      initials: "HQ",
    },
    action: "dispatched morning paper lockup security confirmation",
    time: "3 hours ago",
  },
];
