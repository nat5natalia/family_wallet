package com.vtbfamily.group

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.data.jpa.repository.config.EnableJpaRepositories
import org.springframework.boot.autoconfigure.domain.EntityScan

@SpringBootApplication
@EnableJpaRepositories(basePackages = ["com.vtbfamily.group.repository"])
@EntityScan(basePackages = ["com.vtbfamily.group.model"])
class GroupServiceApplication

fun main(args: Array<String>) {
    runApplication<GroupServiceApplication>(*args)
}