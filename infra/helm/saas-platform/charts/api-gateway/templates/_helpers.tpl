{{- define "api-gateway.name" -}}
{{- include "common.name" . }}
{{- end }}
{{- define "api-gateway.fullname" -}}
{{- include "common.fullname" . }}
{{- end }}
{{- define "api-gateway.labels" -}}
{{- include "common.labels" . }}
{{- end }}
{{- define "api-gateway.selectorLabels" -}}
{{- include "common.selectorLabels" . }}
{{- end }}
