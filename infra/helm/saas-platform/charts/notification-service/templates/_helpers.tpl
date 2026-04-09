{{- define "notification-service.name" -}}
{{- include "common.name" . }}
{{- end }}
{{- define "notification-service.fullname" -}}
{{- include "common.fullname" . }}
{{- end }}
{{- define "notification-service.labels" -}}
{{- include "common.labels" . }}
{{- end }}
{{- define "notification-service.selectorLabels" -}}
{{- include "common.selectorLabels" . }}
{{- end }}
