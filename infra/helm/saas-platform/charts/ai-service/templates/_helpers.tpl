{{- define "ai-service.name" -}}
{{- include "common.name" . }}
{{- end }}
{{- define "ai-service.fullname" -}}
{{- include "common.fullname" . }}
{{- end }}
{{- define "ai-service.labels" -}}
{{- include "common.labels" . }}
{{- end }}
{{- define "ai-service.selectorLabels" -}}
{{- include "common.selectorLabels" . }}
{{- end }}
