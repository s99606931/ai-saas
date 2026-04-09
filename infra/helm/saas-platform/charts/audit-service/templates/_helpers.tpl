{{- define "audit-service.name" -}}
{{- include "common.name" . }}
{{- end }}
{{- define "audit-service.fullname" -}}
{{- include "common.fullname" . }}
{{- end }}
{{- define "audit-service.labels" -}}
{{- include "common.labels" . }}
{{- end }}
{{- define "audit-service.selectorLabels" -}}
{{- include "common.selectorLabels" . }}
{{- end }}
