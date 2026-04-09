{{- define "subscription-service.name" -}}
{{- include "common.name" . }}
{{- end }}
{{- define "subscription-service.fullname" -}}
{{- include "common.fullname" . }}
{{- end }}
{{- define "subscription-service.labels" -}}
{{- include "common.labels" . }}
{{- end }}
{{- define "subscription-service.selectorLabels" -}}
{{- include "common.selectorLabels" . }}
{{- end }}
