// Nor'easters Portal Theme - Reusable style classes

export const portalTheme = {
  // Cards and containers
  card: "rounded-xl border border-[#00c4ff]/20 p-6",
  cardBg: "bg-[rgba(18,26,36,0.8)]",
  cardHover: "hover:border-[#00c4ff]/40 transition-all hover:shadow-[0_0_20px_rgba(0,196,255,0.1)]",
  
  // Text
  heading: "text-white font-[Oswald] tracking-wide",
  subheading: "text-gray-400",
  bodyText: "text-gray-300",
  mutedText: "text-gray-500",
  
  // Buttons
  btnPrimary: "bg-[#00c4ff] hover:bg-[#00a3d9] text-white rounded-lg font-medium transition-colors shadow-lg shadow-[#00c4ff]/20",
  btnSecondary: "border border-[#00c4ff]/30 text-[#00c4ff] hover:bg-white/5 rounded-lg font-medium transition-colors",
  btnDanger: "bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors",
  btnCancel: "border border-gray-600 text-gray-300 hover:bg-white/5 rounded-lg font-medium transition-colors",
  
  // Inputs
  input: "w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]",
  inputLabel: "block text-sm font-medium text-gray-400 mb-1",
  
  // Tables
  tableHeader: "border-b border-[#00c4ff]/20 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider",
  tableRow: "border-b border-[#00c4ff]/10 hover:bg-white/5",
  
  // Modals
  modalOverlay: "fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4",
  modalContent: "rounded-xl shadow-xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto border border-[#00c4ff]/30",
  modalBg: "bg-[rgba(18,26,36,0.98)]",
  
  // Badges & Pills
  badge: "px-3 py-1 rounded-full text-sm font-medium",
  badgePrimary: "bg-[#00c4ff]/20 text-[#00c4ff] border border-[#00c4ff]/30",
};
