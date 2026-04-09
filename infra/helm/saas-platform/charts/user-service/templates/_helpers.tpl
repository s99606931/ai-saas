{{- define "user-service.name" -}}
{{- include "common.name" . }}
{{- end }}
{{- define "user-service.fullname" -}}
{{- include "common.fullname" . }}
{{- end }}
{{- define "user-service.labels" -}}
{{- include "common.labels" . }}
{{- end }}
{{- define "user-service.selectorLabels" -}}
{{- include "common.selectorLabels" . }}
{{- end }}
