import '@fontsource-variable/inter'
import '@fontsource-variable/space-grotesk'
import '@fontsource-variable/jetbrains-mono'
import './landing.css'

// Old share links pointed at the root. Keep them working by sending them to
// the studio while leaving clean campaign URLs on the landing page alone.
const params = new URLSearchParams(window.location.search)
if (params.has('shape')) {
  window.location.replace(`/studio/${window.location.search}`)
}
