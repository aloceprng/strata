from django.conf import settings
from django.contrib import admin
from django.urls import path
from django.views.static import serve

urlpatterns = [
    path('admin/', admin.site.urls),
]

if settings.DEBUG:
    urlpatterns += [
        path(
            'artifacts/<path:path>',
            serve,
            {'document_root': settings.ARTIFACT_ROOT},
        ),
    ]
