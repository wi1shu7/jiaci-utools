import { Button } from "@/components/ui/button"

export function IconButton({ label, size = "icon-sm", variant = "ghost", ...props }) {
  return <Button type="button" size={size} variant={variant} aria-label={label} title={label} {...props} />
}

export function AiBadge() {
  return <span className="ai-badge" title="AI 生成">AI</span>
}

export function Notice({ message }) {
  return <div className="notice" role="status">{message && <p>{message}</p>}</div>
}
