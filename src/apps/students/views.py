from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from .models import Student
from .serializers import StudentSerializer
from .permissions import HasInstitute


class StudentViewSet(ModelViewSet):
    serializer_class = StudentSerializer
    permission_classes = [IsAuthenticated, HasInstitute]

    def get_queryset(self):
        # manager is already tenant-scoped by middleware; keep explicit for clarity
        return Student.objects.all()
