import { Phone, Mail, MessageSquare } from "lucide-react";

interface ContactLinksProps {
  phone?: string | null;
  email?: string | null;
  showText?: boolean;
  className?: string;
  compact?: boolean;
}

// Format phone number for display
function formatPhoneDisplay(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");
  
  // Format as (XXX) XXX-XXXX if 10 digits
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  // Format as +X (XXX) XXX-XXXX if 11 digits (with country code)
  if (digits.length === 11) {
    return `+${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  // Return original if can't format
  return phone;
}

// Clean phone number for tel/sms links
function cleanPhoneForLink(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function PhoneLink({ 
  phone, 
  showLabel = true,
  className = "" 
}: { 
  phone: string; 
  showLabel?: boolean;
  className?: string;
}) {
  const cleanPhone = cleanPhoneForLink(phone);
  const displayPhone = formatPhoneDisplay(phone);
  
  return (
    <a 
      href={`tel:${cleanPhone}`}
      className={`inline-flex items-center gap-2 text-[#00c4ff] hover:text-[#00e5ff] hover:underline transition-colors ${className}`}
    >
      <Phone className="w-4 h-4 flex-shrink-0" />
      {showLabel && <span>{displayPhone}</span>}
    </a>
  );
}

export function TextLink({ 
  phone, 
  showLabel = true,
  className = "" 
}: { 
  phone: string; 
  showLabel?: boolean;
  className?: string;
}) {
  const cleanPhone = cleanPhoneForLink(phone);
  const displayPhone = formatPhoneDisplay(phone);
  
  return (
    <a 
      href={`sms:${cleanPhone}`}
      className={`inline-flex items-center gap-2 text-[#00c4ff] hover:text-[#00e5ff] hover:underline transition-colors ${className}`}
    >
      <MessageSquare className="w-4 h-4 flex-shrink-0" />
      {showLabel && <span>{displayPhone}</span>}
    </a>
  );
}

export function EmailLink({ 
  email, 
  showLabel = true,
  className = "" 
}: { 
  email: string; 
  showLabel?: boolean;
  className?: string;
}) {
  return (
    <a 
      href={`mailto:${email}`}
      className={`inline-flex items-center gap-2 text-[#00c4ff] hover:text-[#00e5ff] hover:underline transition-colors ${className}`}
    >
      <Mail className="w-4 h-4 flex-shrink-0" />
      {showLabel && <span>{email}</span>}
    </a>
  );
}

// Combined contact links row with call, text, and email buttons
export function ContactLinksRow({ 
  phone, 
  email,
  className = "" 
}: ContactLinksProps) {
  if (!phone && !email) return null;
  
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {phone && (
        <>
          <a 
            href={`tel:${cleanPhoneForLink(phone)}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[rgba(0,196,255,0.15)] border border-[#00c4ff]/30 rounded-lg text-[#00c4ff] hover:bg-[rgba(0,196,255,0.25)] transition-colors text-sm"
            title="Call"
          >
            <Phone className="w-3.5 h-3.5" />
            Call
          </a>
          <a 
            href={`sms:${cleanPhoneForLink(phone)}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[rgba(0,196,255,0.15)] border border-[#00c4ff]/30 rounded-lg text-[#00c4ff] hover:bg-[rgba(0,196,255,0.25)] transition-colors text-sm"
            title="Text"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Text
          </a>
        </>
      )}
      {email && (
        <a 
          href={`mailto:${email}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[rgba(0,196,255,0.15)] border border-[#00c4ff]/30 rounded-lg text-[#00c4ff] hover:bg-[rgba(0,196,255,0.25)] transition-colors text-sm"
          title="Email"
        >
          <Mail className="w-3.5 h-3.5" />
          Email
        </a>
      )}
    </div>
  );
}

// Full contact info display with all details
export default function ContactLinks({ 
  phone, 
  email, 
  showText = true,
  className = "",
  compact = false
}: ContactLinksProps) {
  if (!phone && !email) return null;
  
  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {phone && (
          <>
            <a 
              href={`tel:${cleanPhoneForLink(phone)}`}
              className="p-1.5 rounded-md hover:bg-[rgba(0,196,255,0.15)] text-[#00c4ff] transition-colors"
              title="Call"
            >
              <Phone className="w-4 h-4" />
            </a>
            {showText && (
              <a 
                href={`sms:${cleanPhoneForLink(phone)}`}
                className="p-1.5 rounded-md hover:bg-[rgba(0,196,255,0.15)] text-[#00c4ff] transition-colors"
                title="Text"
              >
                <MessageSquare className="w-4 h-4" />
              </a>
            )}
          </>
        )}
        {email && (
          <a 
            href={`mailto:${email}`}
            className="p-1.5 rounded-md hover:bg-[rgba(0,196,255,0.15)] text-[#00c4ff] transition-colors"
            title="Email"
          >
            <Mail className="w-4 h-4" />
          </a>
        )}
      </div>
    );
  }
  
  return (
    <div className={`space-y-2 ${className}`}>
      {phone && (
        <div className="flex items-center gap-4">
          <PhoneLink phone={phone} />
          {showText && <TextLink phone={phone} />}
        </div>
      )}
      {email && <EmailLink email={email} />}
    </div>
  );
}
