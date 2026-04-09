{{- define "security-monitor-service.name" -}}
{{- include "common.name" . }}
{{- end }}
{{- define "security-monitor-service.fullname" -}}
{{- include "common.fullname" . }}
{{- end }}
{{- define "security-monitor-service.labels" -}}
{{- include "common.labels" . }}
{{- end }}
{{- define "security-monitor-service.selectorLabels" -}}
{{- include "common.selectorLabels" . }}
{{- end }}
