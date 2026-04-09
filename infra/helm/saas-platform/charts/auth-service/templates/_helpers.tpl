{{- define "auth-service.name" -}}
{{- include "common.name" . }}
{{- end }}
{{- define "auth-service.fullname" -}}
{{- include "common.fullname" . }}
{{- end }}
{{- define "auth-service.labels" -}}
{{- include "common.labels" . }}
{{- end }}
{{- define "auth-service.selectorLabels" -}}
{{- include "common.selectorLabels" . }}
{{- end }}
