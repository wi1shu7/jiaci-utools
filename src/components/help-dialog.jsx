import { CircleHelp, X } from "lucide-react"
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { IconButton } from "@/components/controls"

export function HelpDialog({ login = false }) {
  const title = login ? "登录帮助" : "设置说明"
  return (
    <Dialog>
      <DialogTrigger asChild>
        <IconButton label={title}><CircleHelp /></IconButton>
      </DialogTrigger>
      <DialogContent className="help-dialog" showCloseButton={false} aria-describedby={undefined}>
        <DialogTitle>{title}</DialogTitle>
        <DialogClose asChild>
          <IconButton label="关闭" className="help-close"><X /></IconButton>
        </DialogClose>
        {login ? (
          <div className="help-sections">
            <section>
              <h3>服务地址</h3>
              <p>填写部署加词的站点地址，例如 <code>https://jiaci.example.com</code>。</p>
            </section>
            <section>
              <h3>登录方式</h3>
              <p>选择该站点启用的方式。密钥由站点管理员分配。邮箱登录时，先发送验证码，再填入邮件中的六位数字。</p>
            </section>
          </div>
        ) : (
          <div className="help-sections">
            <section>
              <h3>外观</h3>
              <p>在「通用」中分别设置两窗的明暗模式。学习小窗还可调整整体缩放、背景和置顶。完全透明时，拖动顶部标志移动小窗。</p>
            </section>
            <section>
              <h3>老板键</h3>
              <p>在「快捷键」中点击「老板键」右侧的全局设置，在 uTools 绑定按键。切到其他应用后，按一次隐藏小窗，再按一次回到当前词卡。</p>
            </section>
            <section>
              <h3>录制窗口内按键</h3>
              <p>点击操作对应的按键后录制。按 Esc 取消，按退格键清除。需要跨应用使用时，在同一行设置全局按键。</p>
            </section>
            <section>
              <h3>后台运行</h3>
              <p>小窗依赖 uTools 的插件后台运行。长期使用可在 uTools 中关闭「退出到后台立即结束运行」，并调整后台结束时间。</p>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
