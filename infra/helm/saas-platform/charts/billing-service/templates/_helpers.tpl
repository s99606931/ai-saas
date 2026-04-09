{{- define "billing-service.name" -}}
{{- include "common.name" . }}
{{- end }}
{{- define "billing-service.fullname" -}}
{{- include "common.fullname" . }}
{{- end }}
{{- define "billing-service.labels" -}}
{{- include "common.labels" . }}
{{- end }}
{{- define "billing-service.selectorLabels" -}}
{{- include "common.selectorLabels" . }}
{{- end }}
