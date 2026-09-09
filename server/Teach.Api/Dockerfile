# Teach.Api — сервер-оркестратор. База SQLite лежит на томе /data.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Teach.Api.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_URLS=http://0.0.0.0:8080 \
    Teach__Db="Data Source=/data/teach.db" \
    Teach__Model=auto
VOLUME /data
EXPOSE 8080
ENTRYPOINT ["dotnet", "Teach.Api.dll"]
